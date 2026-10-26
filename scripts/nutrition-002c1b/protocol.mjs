import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Session } from './snapshot.mjs';
import { run } from './local.mjs';
export const PROTOCOL = 'nutrition-002c1b-ddl-stability/v1';
export const BASE = 'a0e7440088ee2d9cd9eccd4706cdf9ecd07e6a8f';
export const BASE_TREE = 'c48c2d3f26726ede8b1c15ed66e0abd41ded1dfc';
export const FILES = ['scripts/nutrition-002c1b/local.mjs', 'scripts/nutrition-002c1b/snapshot.mjs', 'scripts/nutrition-002c1b/protocol.mjs', 'scripts/nutrition-002c1b/fidelity.mjs', 'scripts/nutrition-002c1b/qualify-local.mjs', 'scripts/nutrition-002c1b/contracts.test.mjs', 'ops/recovery/nutrition-002c1b/ddl-v1.sql', 'ops/recovery/nutrition-002c/overlay-v1.sql', 'scripts/nutrition-002c1a/raw.sql', 'scripts/nutrition-002c1a/catalog.mjs', 'scripts/nutrition-002c1/catalog.mjs', 'scripts/nutrition-002c1/catalog.sql', 'scripts/phase-11i-migration-inventory.mjs', 'scripts/nutrition-002c/local-postgres.mjs', 'scripts/phase-11i-recovery-contract.mjs', 'ops/recovery/nutrition-002c1a/catalog-v1.json', 'ops/recovery/nutrition-002c1/catalog-v1.json', '.github/workflows/nutrition-002c1b-local.yml', 'scripts/check-workflow-security.mjs'];
export function implementationDigest() {
    const h = createHash('sha256');
    for (const p of FILES)
        h.update(p + '\0').update(readFileSync(new URL('../../' + p, import.meta.url)));
    return h.digest('hex');
}
const fail = code => { throw new Error(code); };
export async function install(cluster) {
    for (const path of ['nutrition-002c/overlay-v1.sql', 'nutrition-002c1b/ddl-v1.sql'])
        await cluster.sql(readFileSync(new URL('../../ops/recovery/' + path, import.meta.url), 'utf8'));
    await cluster.sql(`update recovery_ops.control set expected_source='${implementationDigest()}',state='IDLE',reconciliation='FRESH_LOCAL_REVIEW' where singleton and epoch=0 and state='RECONCILIATION_REQUIRED';`);
}
export class Operation {
    static async admit(cluster, kind, boundary, { source = implementationDigest(), protocol = PROTOCOL, seconds = 90 } = {}) {
        if (!['BACKUP', 'MIGRATION'].includes(kind) || ![44, 45].includes(boundary) || !/^[a-f0-9]{64}$/.test(source) || !/^nutrition-[a-z0-9/-]+$/.test(protocol) || !Number.isInteger(seconds) || seconds < 1 || seconds > 300)
            fail('N002C1B_ADMISSION_INPUT');
        const op = new Operation();
        op.cluster = cluster;
        op.kind = kind;
        op.id = randomUUID();
        op.source = source;
        op.clients = [];
        op.owner = new Session(cluster);
        try {
            const [locked] = await op.owner.query('select pg_try_advisory_lock(2002003,1);');
            if (locked !== 't')
                fail('N002C1B_ADMINISTRATIVE_COLLISION');
            op.epoch = Number((await op.owner.query(`select recovery_ops.ddl_admit('${op.id}','${kind}',${boundary},'${source}','${protocol}',${seconds});`))[0]);
            if (!Number.isSafeInteger(op.epoch) || op.epoch < 1)
                fail('N002C1B_EPOCH_DENIED');
            await op.check();
            return op;
        }
        catch (e) {
            await op.owner.close();
            throw e;
        }
    }
    async check() { await this.owner.query(`select recovery_ops.ddl_check('${this.id}',${this.epoch},'${this.kind}','${this.source}');`); }
    name(label) { if (!['schema', 'reference', 'application', 'auth'].includes(label))
        fail('N002C1B_PARTICIPANT_LABEL'); return 'n002c_' + this.id.replaceAll('-', '') + '_' + label; }
    async register(label) {
        await this.check();
        await this.cluster.sql(`select recovery_ops.register('${this.id}',${this.epoch},'${label}','${this.name(label)}');`);
    }
    track(session) { this.clients.push(session); return session; }
    async migration(sql) {
        if (this.kind !== 'MIGRATION')
            fail('N002C1B_OPERATION_KIND');
        // Deliberately fixture-only: no CLI, SQL file, URL or environment input.
        // Registration of the DDL backend is the durable owner identity in attempts.
        await this.check();
        await this.owner.query(sql);
        await this.check();
    }
    async seal(hash) {
        if (!/^[a-f0-9]{64}$/.test(hash))
            fail('N002C1B_SEAL_INPUT');
        await this.check();
        await this.owner.query(`select recovery_ops.seal('${this.id}',${this.epoch},'${hash}');`);
    }
    async stopParticipant(label, outputHash) {
        if (!/^[a-f0-9]{64}$/.test(outputHash))
            fail("N002C1B_PARTICIPANT_HASH");
        await this.cluster.sql(`update recovery_ops.participants set state='STOPPED',stopped_at=clock_timestamp(),output_sha256='${outputHash}' where attempt_id='${this.id}' and label='${label}' and not exists(select 1 from pg_stat_activity where application_name='${this.name(label)}');`);
    }
    async close() { await this.owner.close(); }
    async reconcile(outcome) {
        if (!['DISCARDED', 'VERIFIED_LOCAL_ARTIFACT', 'MIGRATION_READBACK_REVIEWED'].includes(outcome))
            fail('N002C1B_TERMINAL_INPUT');
        for (const s of this.clients)
            if (!s.process.done)
                fail('N002C1B_CLIENT_STILL_PRESENT');
        if (!this.owner.process.done)
            fail('N002C1B_OWNER_CLIENT_STILL_PRESENT');
        const r = new Session(this.cluster);
        try {
            if ((await r.query('select pg_try_advisory_lock(2002003,1);'))[0] !== 't')
                fail('N002C1B_ADMINISTRATIVE_COLLISION');
            await r.query(`select recovery_ops.ddl_reconcile('${this.id}',${this.epoch},'${outcome}');`);
        }
        finally {
            await r.close();
        }
    }
}
export async function sourceIdentity() { return { sourceCommit: await run('git', ['rev-parse', 'HEAD']), sourceTree: await run('git', ['rev-parse', 'HEAD^{tree}']), implementationSha256: implementationDigest() }; }
