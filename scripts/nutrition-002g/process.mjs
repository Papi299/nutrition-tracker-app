import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const LIMIT = 128 * 1024 * 1024;

export function reject(code) { throw new Error(code); }
// No shell, inherited PG* variables, metadata-selected executable, database URL,
// published port or provider credential. Only task-owned disposable resources.
export function startProcess(command, args, { input, timeoutMs = 15000, limit = LIMIT } = {}) {
  if (!['docker','git','openssl','tar'].includes(command)) reject('N002G_EXECUTABLE_DENIED');
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
    child.once('error', () => { clearTimeout(timer); done = true; rejectPromise(new Error('N002G_PROCESS_SPAWN_FAILED')); });
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
    const error = new Error('N002G_LOCAL_PROCESS_FAILED' + (state ? '_' + state : '') + (r.timedOut ? '_TIMEOUT' : ''));
    Object.defineProperty(error,'localDiagnostic',{value:r.stderr.toString('utf8')});
    throw error;
  }
  return r.stdout.toString('utf8').trim();
}

export class Session {
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
      if (this.pending) { const p = this.pending; this.pending = null; clearTimeout(p.timer); p.reject(new Error('N002G_SESSION_EOF')); }
    }, () => { this.closed = true; this.pending?.reject(new Error('N002G_SESSION_EOF')); });
  }
  query(sql) {
    if (this.closed || this.process.done) return Promise.reject(new Error('N002G_SESSION_EOF'));
    if (this.pending) return Promise.reject(new Error('N002G_CONCURRENT_SESSION_QUERY'));
    const marker = 'n002g_end_' + randomUUID().replaceAll('-','');
    return new Promise((resolve, rejectPromise) => {
      const timer = setTimeout(() => {
        this.pending = null; this.process.child.kill('SIGKILL'); rejectPromise(new Error('N002G_SESSION_TIMEOUT'));
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
  if (contexts.length!==1 || !contexts[0].Endpoints?.docker?.Host?.startsWith('unix://')) reject('N002G_REMOTE_DOCKER_DENIED');
}

export async function waitUntil(probe, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  do { if (await probe()) return; await delay(25); } while (Date.now() < deadline);
  reject('N002G_OBSERVATION_TIMEOUT');
}
