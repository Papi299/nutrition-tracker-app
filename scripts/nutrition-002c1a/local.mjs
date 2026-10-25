import { run, startProcess, IMAGE, assertLocalDocker, waitUntil, snapshotToken } from '../nutrition-002c/local-postgres.mjs';

export { run, IMAGE, waitUntil };
export const CONTAINERS = Object.freeze({ source: 'nutrition-002c1a-source', target: 'nutrition-002c1a-target' });
const LABEL = 'codex.task=NUTRITION-DIARY-CORRECTNESS-002C1A';
const fail = code => { throw new Error(code); };

// These are fixed offline test clusters, never connection strings or provider
// targets. No container identity may come from an artifact or environment value.
export class Cluster {
  #id;
  constructor(side) {
    if (!Object.hasOwn(CONTAINERS, side)) fail('N002C1A_TARGET_DENIED');
    Object.defineProperty(this, 'name', { value:CONTAINERS[side], enumerable:true });
    this.created = false;
  }
  args() {
    if (!this.#id) fail('N002C1A_CLUSTER_NOT_STARTED');
    return ['exec', '-i', this.#id, 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-U', 'supabase_admin', '-d', 'postgres'];
  }
  async sql(sql) { await this.verifyIdentity(); return run('docker', this.args(), { input: sql, timeoutMs: 30000 }); }
  process(sql) { return startProcess('docker', this.args(), { input: sql, timeoutMs: 30000 }); }
  async start() {
    await assertLocalDocker();
    if (await run('docker', ['ps', '-a', '--filter', `name=^/${this.name}$`, '--format', '{{.Names}}'])) fail('N002C1A_EXISTING_CLUSTER_REFUSED');
    this.#id = await run('docker', ['run', '-d', '--name', this.name, '--label', LABEL, '--network', 'none',
      '--tmpfs', '/var/lib/postgresql/data:rw,size=512m', '-e', 'POSTGRES_PASSWORD=local-disposable-only', IMAGE,
      'postgres', '-D', '/var/lib/postgresql/data', '-c', 'listen_addresses=', '-c', 'shared_preload_libraries='], { timeoutMs: 30000 });
    if (!/^[a-f0-9]{64}$/.test(this.#id)) fail('N002C1A_SPAWN_IDENTITY_UNCONFIRMED');
    this.created = true;
    await waitUntil(async () => {
      try { return (await run('docker', ['logs', this.name])).includes('PostgreSQL init process complete; ready for start up.') && await run('docker', this.args(), {input:'select 1;'}) === '1'; }
      catch { return false; }
    }, 60000);
    await this.verify();
  }
  async verifyIdentity() {
    if (!this.#id) fail('N002C1A_CLUSTER_NOT_STARTED');
    await assertLocalDocker();
    const values = JSON.parse(await run('docker', ['inspect', this.name]));
    const c = values[0];
    if (values.length !== 1 || c.Id !== this.#id || c.Config.Image !== IMAGE || c.Config.Labels?.['codex.task'] !== LABEL.split('=')[1] ||
      c.HostConfig.NetworkMode !== 'none' || Object.keys(c.HostConfig.PortBindings ?? {}).length ||
      !c.HostConfig.Tmpfs?.['/var/lib/postgresql/data'] || c.Mounts.some(m => m.Type !== 'tmpfs')) fail('N002C1A_LOCAL_IDENTITY_MISMATCH');
  }
  async verify() {
    await this.verifyIdentity();
    if (await this.sql('show server_version_num;') !== '170006' ||
      (await run('docker', ['exec', this.#id, 'pg_dump', '--version'])) !== 'pg_dump (PostgreSQL) 17.6') fail('N002C1A_VERSION_MISMATCH');
  }
  async dump(snapshot) {
    if (snapshot !== undefined) snapshotToken(snapshot);
    await this.verify();
    if (!this.#id) fail('N002C1A_CLUSTER_NOT_STARTED');
    return run('docker', ['exec', '-i', this.#id, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres',
      '--no-password', '--lock-wait-timeout=2000', '--schema-only', '--schema=public', '--schema=private', '--schema=ingestion',
      ...(snapshot ? [`--snapshot=${snapshot}`] : [])], { timeoutMs: 30000 });
  }
  async stop() {
    if (this.created) {
      // Refuse to remove a replaced container, even when cleanup is requested.
      await this.verifyIdentity();
      await run('docker', ['rm', '-f', this.#id]); this.created = false;
    }
  }
}
