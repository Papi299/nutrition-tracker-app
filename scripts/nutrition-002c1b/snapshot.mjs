import { randomUUID } from 'node:crypto';
import { Cluster } from './local.mjs';
import { startProcess, snapshotToken } from '../nutrition-002c/local-postgres.mjs';
export const PROTOCOL = 'nutrition-002c1b-retained-export-import/v1';
const fail = code => { throw new Error(code); };
// Only fixed local Cluster arguments reach the process. Tokens and backend
// identities remain private; marker framing is not an artifact-selected query API.
export class Session {
    #pending;
    #lines = [];
    constructor(cluster) {
        if (!(cluster instanceof Cluster))
            fail('N002C1B_LOCAL_CLUSTER_REQUIRED');
        this.process = startProcess('docker', cluster.args(), { timeoutMs: 180000 });
        let remainder = '';
        this.process.child.stdout.on('data', chunk => {
            remainder += chunk.toString('utf8');
            let end;
            while ((end = remainder.indexOf('\n')) >= 0) {
                const line = remainder.slice(0, end).replace(/\r$/, '');
                remainder = remainder.slice(end + 1);
                if (line === this.#pending?.marker) {
                    const p = this.#pending;
                    this.#pending = undefined;
                    clearTimeout(p.timer);
                    p.resolve(this.#lines);
                    this.#lines = [];
                }
                else
                    this.#lines.push(line);
            }
        });
        this.process.result.then(() => this.#lost(), () => this.#lost());
    }
    #lost() {
        if (this.#pending) {
            clearTimeout(this.#pending.timer);
            this.#pending.reject(new Error('N002C1B_PARTICIPANT_LOST'));
            this.#pending = undefined;
        }
    }
    async query(sql) {
        if (this.process.done)
            fail('N002C1B_PARTICIPANT_LOST');
        if (this.#pending)
            fail('N002C1B_CONCURRENT_QUERY_DENIED');
        const marker = 'n002c1b_' + randomUUID().replaceAll('-', '');
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.#pending = undefined;
                this.process.child.kill('SIGKILL');
                reject(new Error('N002C1B_PARTICIPANT_TIMEOUT'));
            }, 20000);
            this.#pending = { marker, resolve, reject, timer };
            this.process.child.stdin.write(sql + '\n\\echo ' + marker + '\n');
        });
    }
    async close() {
        if (!this.process.done)
            this.process.child.stdin.end('rollback;\n\\q\n');
        await this.process.result;
    }
}
export class Snapshot {
    #token;
    #owner;
    #readers = [];
    #cluster;
    #closed = false;
    static async open(cluster, admittedOwner) {
        if (!(cluster instanceof Cluster))
            fail('N002C1B_LOCAL_CLUSTER_REQUIRED');
        if (admittedOwner !== undefined && !(admittedOwner instanceof Session))
            fail('N002C1B_ADMITTED_OWNER_REQUIRED');
        await cluster.verify();
        const lease = new Snapshot();
        lease.#cluster = cluster;
        lease.#owner = admittedOwner ?? new Session(cluster);
        try {
            const lines = await lease.#owner.query("set statement_timeout='15000'; set lock_timeout='2000'; set idle_in_transaction_session_timeout='120000'; begin isolation level repeatable read read only; select pg_export_snapshot();");
            lease.#token = snapshotToken(lines[0]);
            await lease.check();
            return lease;
        }
        catch {
            await lease.close();
            fail('N002C1B_EXPORT_FAILED');
        }
    }
    async check() {
        if (this.#closed || this.#owner.process.done)
            fail('N002C1B_EXPORTER_LOST');
        const state = await this.#owner.query("select current_database(),current_setting('server_version_num'),current_setting('transaction_isolation'),current_setting('transaction_read_only');");
        if (state.join('\n') !== 'postgres|170006|repeatable read|on')
            fail('N002C1B_TRANSACTION_STATE');
    }
    async reader(name) {
        await this.check();
        await this.#cluster.verifyIdentity();
        const session = new Session(this.#cluster);
        this.#readers.push(session);
        try {
            // No SQL query in this participant precedes BEGIN/import. SET GUCs do not
            // obtain a transaction snapshot. No temporary/permanent DDL is performed.
            if (name !== undefined) {
                if (!/^n002c_[a-f0-9]{32}_(reference|application|auth)$/.test(name))
                    fail("N002C1B_READER_NAME_DENIED");
                await session.query("set application_name='" + name + "';");
            }
            await session.query("set statement_timeout='15000';set lock_timeout='2000';set idle_in_transaction_session_timeout='120000';begin isolation level repeatable read read only;set transaction snapshot '" + this.#token + "';");
            await this.check();
            return session;
        }
        catch {
            await session.close();
            fail('N002C1B_SNAPSHOT_IMPORT_FAILED');
        }
    }
    async read(session, sql) {
        if (!this.#readers.includes(session))
            fail('N002C1B_UNREGISTERED_READER');
        await this.check();
        const result = await Promise.race([
            session.query(sql),
            this.#owner.process.result.then(() => fail('N002C1B_EXPORTER_LOST')),
        ]);
        await this.check();
        return result;
    }
    async dump(name) { await this.check(); const dump = await this.#cluster.dump(this.#token, name); await this.check(); return dump; }
    // Local qualification seams, never CLI/env flags or eligibility bypasses.
    async importSequenceForTest(afterBegin = '') {
        await this.check();
        return this.#cluster.sql("begin isolation level repeatable read read only;" + afterBegin + "set transaction snapshot '" + this.#token + "';rollback;");
    }
    async terminateExporterForTest() {
        const [pid] = await this.#owner.query('select pg_backend_pid();');
        if (!/^[1-9][0-9]*$/.test(pid))
            fail('N002C1B_BACKEND_IDENTITY');
        await this.#cluster.sql(`select pg_terminate_backend(${pid},2000);`);
        // psql can wait on stdin after an idle backend is terminated. Force a
        // bounded round trip so client EOF is observed before accepting loss.
        await this.#owner.query('select 1;').catch(() => { });
        await this.#owner.process.result;
    }
    async importExpiredForTest() {
        return this.#cluster.sql("begin isolation level repeatable read read only;set transaction snapshot '" + this.#token + "';rollback;");
    }
    async releaseForCompletion() {
        await this.check();
        await Promise.all(this.#readers.map(s => s.close()));
        await this.#owner.query("rollback;");
        this.#closed = true;
    }
    async close() {
        this.#closed = true;
        await Promise.allSettled(this.#readers.map(s => s.close()));
        if (this.#owner)
            await this.#owner.close();
    }
}
