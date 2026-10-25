import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export const CONTAINER = 'nutrition-002c-local-postgres';
export const IMAGE = 'public.ecr.aws/supabase/postgres@sha256:28f0e16a019e648089fc1a6d333549a55548f6019c15ae4bd7cd58b989027518';
export const LABEL = 'codex.task=NUTRITION-DIARY-CORRECTNESS-002C';
export const DATABASE = 'nutrition002c';
export const RESTORE_DATABASE = 'nutrition002c_restore';
export const PROTOCOL = 'nutrition-002c-local/v1';
const LIMIT = 128 * 1024 * 1024;

export function reject(code) { throw new Error(code); }
export function uuid(value) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value ?? '')) reject('N002C_INVALID_UUID');
  return value;
}
export function digest(value) {
  if (!/^[a-f0-9]{64}$/.test(value ?? '')) reject('N002C_INVALID_DIGEST');
  return value;
}
export function snapshotToken(value) {
  if (!/^[A-F0-9]{8}-[A-F0-9]{8}-[0-9]+$/.test(value ?? '')) reject('N002C_INVALID_SNAPSHOT');
  return value;
}
export function identifier(value) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(value ?? '')) reject('N002C_INVALID_IDENTIFIER');
  return '"' + value + '"';
}

// No shell, inherited PG* variables, metadata-selected executable, database URL,
// published port or provider credential. Only these two disposable databases.
export function startProcess(command, args, { input, timeoutMs = 15000, limit = LIMIT } = {}) {
  if (!['docker','git','openssl','tar'].includes(command)) reject('N002C_EXECUTABLE_DENIED');
  const child = spawn(command, args, { env: { PATH: process.env.PATH, HOME: process.env.HOME }, stdio: ['pipe','pipe','pipe'] });
  const stdout = [], stderr = [];
  let size = 0, overflow = false, timedOut = false, done = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
  function collect(target, chunk) {
    size += chunk.length;
    if (size > limit) { overflow = true; child.kill('SIGKILL'); } else target.push(chunk);
  }
  child.stdout.on('data', chunk => collect(stdout, chunk));
  child.stderr.on('data', chunk => collect(stderr, chunk));
  child.stdin.on('error', () => {});
  const result = new Promise((resolve, rejectPromise) => {
    child.once('error', () => { clearTimeout(timer); done = true; rejectPromise(new Error('N002C_PROCESS_SPAWN_FAILED')); });
    child.once('close', (code, signal) => {
      clearTimeout(timer); done = true;
      resolve({ code, signal, timedOut, overflow, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });
  // Attach immediately: an exporter can fail while another participant starts.
  result.catch(() => {});
  if (input !== undefined) child.stdin.end(input);
  return { child, result, get done() { return done; } };
}
export async function run(command, args, options) {
  const r = await startProcess(command, args, { ...options, input: options?.input ?? '' }).result;
  if (r.code !== 0 || r.timedOut || r.overflow) {
    const state = r.stderr.toString('utf8').match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5})(?:\s|$)/m)?.[1];
    const error = new Error('N002C_LOCAL_PROCESS_FAILED' + (state ? '_' + state : '') + (r.timedOut ? '_TIMEOUT' : ''));
    Object.defineProperty(error,'localDiagnostic',{value:r.stderr.toString('utf8')});
    throw error;
  }
  return r.stdout.toString('utf8').trim();
}

export class LocalDatabase {
  constructor(database = DATABASE) {
    if (![DATABASE, RESTORE_DATABASE].includes(database)) reject('N002C_DATABASE_DENIED');
    this.database = database;
  }
  args(user = 'supabase_admin', name = 'n002c_control') {
    if (!['postgres','supabase_admin','authenticated','anon','n002c_writer'].includes(user)) reject('N002C_ROLE_DENIED');
    if (!/^n002c_[a-z0-9_]{1,60}$/.test(name)) reject('N002C_APPLICATION_NAME_DENIED');
    return ['exec','-i','-e',`PGAPPNAME=${name}`,CONTAINER,'psql','-XqAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U',user,'-d',this.database];
  }
  async sql(sql, options = {}) {
    return run('docker', this.args(options.user, options.name), { input: sql, timeoutMs: options.timeoutMs ?? 15000 });
  }
  process(sql, options = {}) {
    return startProcess('docker', this.args(options.user, options.name), { input: sql, timeoutMs: options.timeoutMs ?? 15000 });
  }
  async session(name = 'n002c_owner', user = 'supabase_admin') {
    const session = new Session(this.args(user, name));
    await session.query("set statement_timeout='5000'; set lock_timeout='2000'; select pg_backend_pid();");
    return session;
  }
  dump(snapshot, component, name) {
    snapshotToken(snapshot);
    const flags = {
      schema: ['--schema-only','--schema=public','--schema=private','--schema=ingestion'],
      application: ['--data-only','--schema=public','--schema=ingestion'],
      auth: ['--data-only','--table=auth.users','--table=auth.identities','--table=auth.mfa_factors','--table=auth.webauthn_credentials'],
    }[component];
    if (!flags || !/^n002c_[a-f0-9]{32}_(schema|application|auth)$/.test(name)) reject('N002C_DUMP_COMPONENT_DENIED');
    return startProcess('docker', ['exec','-i','-e',`PGAPPNAME=${name}`,CONTAINER,'pg_dump','-U','supabase_admin','-d',this.database,
      '--format=plain','--no-password',`--snapshot=${snapshot}`,'--lock-wait-timeout=2000',...flags], { input: '', timeoutMs: 30000 });
  }
}

class Session {
  constructor(args) {
    this.process = startProcess('docker', args, { timeoutMs: 310000 });
    this.lines = [];
    this.pending = null;
    this.closed = false;
    let remainder = '';
    this.process.child.stdout.on('data', chunk => {
      remainder += chunk.toString('utf8');
      for (;;) {
        const end = remainder.indexOf('\n');
        if (end < 0) break;
        const line = remainder.slice(0,end).replace(/\r$/, ''); remainder = remainder.slice(end+1);
        if (this.pending && line === this.pending.marker) {
          const { resolve, timer } = this.pending; this.pending = null; clearTimeout(timer);
          resolve(this.lines); this.lines = [];
        } else this.lines.push(line);
      }
    });
    this.process.result.then(() => {
      this.closed = true;
      if (this.pending) { const p = this.pending; this.pending = null; clearTimeout(p.timer); p.reject(new Error('N002C_SESSION_EOF')); }
    }, () => { this.closed = true; this.pending?.reject(new Error('N002C_SESSION_EOF')); });
  }
  query(sql) {
    if (this.closed || this.process.done) return Promise.reject(new Error('N002C_SESSION_EOF'));
    if (this.pending) return Promise.reject(new Error('N002C_CONCURRENT_SESSION_QUERY'));
    const marker = 'n002c_end_' + randomUUID().replaceAll('-','');
    return new Promise((resolve, rejectPromise) => {
      const timer = setTimeout(() => {
        this.pending = null; this.process.child.kill('SIGKILL'); rejectPromise(new Error('N002C_SESSION_TIMEOUT'));
      }, 7000);
      this.pending = { marker, resolve, reject: rejectPromise, timer };
      this.process.child.stdin.write(sql + '\n\\echo ' + marker + '\n');
    });
  }
  async close() {
    if (!this.process.done) { this.process.child.stdin.end('\\q\n'); await this.process.result; }
  }
  terminateClient() { this.process.child.kill('SIGKILL'); }
}

export async function assertLocalDocker() {
  const contexts=JSON.parse(await run('docker',['context','inspect']));
  if (contexts.length!==1 || !contexts[0].Endpoints?.docker?.Host?.startsWith('unix://')) reject('N002C_REMOTE_DOCKER_DENIED');
}

export async function verifyLocalTarget() {
  await assertLocalDocker();
  const actual = JSON.parse(await run('docker', ['inspect',CONTAINER]));
  const c = actual[0];
  if (actual.length !== 1 || c.Config.Image !== IMAGE ||
      c.Config.Labels?.['codex.task'] !== LABEL.split('=')[1] ||
      c.HostConfig.NetworkMode !== 'none' || Object.keys(c.HostConfig.PortBindings ?? {}).length ||
      !c.HostConfig.Tmpfs?.['/var/lib/postgresql/data'] ||
      c.Mounts.some(m => m.Type !== 'tmpfs')) reject('N002C_LOCAL_IDENTITY_MISMATCH');
  const db = new LocalDatabase();
  if ((await db.sql('show server_version_num;')) !== '170006') reject('N002C_POSTGRES_VERSION_MISMATCH');
  if (!(await run('docker',['exec',CONTAINER,'pg_dump','--version'])).endsWith('17.6')) reject('N002C_DUMP_VERSION_MISMATCH');
}

export async function waitUntil(probe, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  do { if (await probe()) return; await delay(25); } while (Date.now() < deadline);
  reject('N002C_OBSERVATION_TIMEOUT');
}
