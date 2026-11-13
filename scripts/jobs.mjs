import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { copyFileSync, existsSync, readFileSync, statSync, lstatSync, unlinkSync, realpathSync, constants } from 'node:fs';
import { dirname, basename, delimiter, join, extname, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { assertNotProtected, assertWritable } from './engine.mjs';
import { readRp } from './rp-read.mjs';
import { resolvePasteTarget } from './version.mjs';

const HELPER = fileURLToPath(new URL('./gui-roundtrip.swift', import.meta.url));
const HOST_SCRIPT = fileURLToPath(new URL('./axure-host.ps1', import.meta.url));
const GENERATOR = fileURLToPath(new URL('./prototype-worker.mjs', import.meta.url));
const macRunner = args => spawn('/usr/bin/swift', [HELPER, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

// 把 PowerShell 宿主的一次性 JSON 结果翻译成与 macOS 宿主相同的阶段标记，
// 让上层 job 校验不区分平台。
function windowsRunner(args) {
  const [file, version, preview] = args;
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  let host = null;
  child.kill = () => { try { host?.kill(); } catch { /* already gone */ } };
  (async () => {
    const { windowsHostExecutable } = await import('../studio/axure-preview.mjs');
    const exe = windowsHostExecutable(Number(version));
    const powershell = join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    host = spawn(powershell, ['-NoProfile', '-NonInteractive', '-File', HOST_SCRIPT,
      '-File', file, '-Exe', exe, '-Title', basename(file, extname(file))], { windowsHide: true });
    let stdout = '';
    host.stdout.on('data', chunk => { stdout += chunk; });
    host.stderr.on('data', chunk => { child.stderr.write(chunk); });
    host.once('error', error => child.emit('error', error));
    host.once('close', code => {
      const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
      let result = null;
      try { result = line ? JSON.parse(line) : null; } catch { /* host crashed before reporting */ }
      if (result) {
        for (const [key, phase] of [['opened', 'opened'], ['saved', 'saved'], ['closed', 'closed'], ['reopened', 'reopened'], ['previewVerified', 'preview']]) {
          if (result[key]) child.stderr.write(`AXURE_GUI_PHASE ${phase}\n`);
        }
        if (result.saveCommandIssued) child.stderr.write('AXURE_GUI_SAVE_COMMAND issued\n');
      }
      const ok = Boolean(result?.opened && result?.closed && result?.reopened && (!preview || result?.previewVerified));
      if (ok) child.stdout.write('saved-closed-reopened\n');
      else child.stderr.write(`${result?.error || line || `Axure 宿主退出码 ${code}`}\n`);
      child.stdout.end();
      child.stderr.end();
      child.emit('close', ok ? 0 : (code || 1));
    });
  })().catch(error => child.emit('error', error));
  return child;
}

export class JobManager {
  constructor({ runner = (process.platform === 'win32' ? windowsRunner : macRunner) } = {}) {
    this.runner = runner;
    this.jobs = new Map();
    this.active = null;
  }

  list() { return [...this.jobs.values()].map(job => this.get(job.id)); }
  get(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`未知 job ${id}`);
    const { child, done, finish, input, inputHashes, outputCopy, ...data } = job;
    if (['generate-prototype', 'revise-prototype'].includes(job.type)) delete data.stdout;
    return structuredClone(data);
  }

  startGeneration(input) {
    return this.startPrototype(input, 'generate-prototype');
  }

  startRevision(input) {
    return this.startPrototype(input, 'revise-prototype');
  }

  startPrototype(input, type) {
    const writeRoot = (process.env.AXURE_WRITE_ROOT || '').split(delimiter).filter(Boolean)[0] || process.cwd();
    const output = input.output && input.output !== 'auto' ? resolve(writeRoot, input.output) : null;
    if (output) assertWritable(output);
    const args = structuredClone({ ...input, ...(output ? { output } : {}) });
    delete args.async;
    const inputHashes = {};
    for (const file of [args.source, args.sourcePath,
      typeof args.spec === 'string' && !args.spec.trimStart().startsWith('{') ? args.spec : null,
      args.baseRp, args.template, ...(type === 'revise-prototype' ? [args.rp, `${args.rp}.baseline.json`] : [])].filter(Boolean)) {
      const path = resolve(file);
      assertNotProtected(path);
      inputHashes[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
    }
    const id = randomUUID();
    const job = { id, type, input: args, inputHashes, output, status: 'queued', phase: 'queued',
      createdAt: new Date().toISOString(), stdout: '', stderr: '', result: null };
    job.done = new Promise(resolveDone => { job.finish = resolveDone; });
    this.jobs.set(id, job);
    setImmediate(() => this.pump());
    return this.get(id);
  }

  pumpGeneration(job) {
    job.phase = job.type === 'revise-prototype' ? 'revise' : 'generate'; job.startedAt = new Date().toISOString();
    try {
      const child = job.child = spawn(process.execPath, [GENERATOR], { detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
      child.on('message', message => {
        if (message?.type !== 'return_rp-progress') return;
        job.phase = message.phase;
        job.progress = { phase: message.phase, completed: message.completed, total: message.total, updatedAt: new Date().toISOString() };
      });
      child.stdout.on('data', c => { job.stdout += c; });
      child.stderr.on('data', c => { job.stderr += c; });
      child.stdin.on('error', error => { job.stderr += error.message; });
      child.once('error', error => this.complete(job, 1, error.message));
      child.once('close', code => {
        try {
          job.result = JSON.parse(job.stdout);
          job.phase = job.result.stage ?? (code === 0 ? 'completed' : 'failed');
          job.outputSha256 = job.result.sha256 ?? null;
          job.output = job.result.output ?? job.output;
          job.validation = job.result.verification ?? null;
          job.completedAt = new Date().toISOString();
          job.stdout = '';
          this.complete(job, code, code === 0 && !['completed', 'merged', 'planned'].includes(job.result.status) ? '工作进程未返回成功状态' : '');
        } catch { this.complete(job, code ?? 1, '生成子进程未返回完整结果；请查看 stderr 和保留的构建现场。'); }
      });
      child.stdin.end(JSON.stringify({ type: job.type, arguments: job.input, inputHashes: job.inputHashes }));
    } catch (error) { this.complete(job, 1, error.message); }
  }

  async startRoundtrip({ source, output, wait = false, version, preview = false }) {
    if (!['darwin', 'win32'].includes(process.platform)) throw new Error('GUI roundtrip 需要 macOS 或 Windows 桌面会话');
    assertNotProtected(source);
    source = realpathSync.native(source);
    if (!output || output === 'auto') {
      const stem = source.replace(/\.rp$/i, '').replace(/-gui(-\d+)?$/, '');
      output = !existsSync(`${stem}-gui.rp`) ? `${stem}-gui.rp` : (() => {
        for (let n = 2; ; n++) if (!existsSync(`${stem}-gui-${n}.rp`)) return `${stem}-gui-${n}.rp`;
      })();
    }
    assertWritable(output);
    // 不先做词法归一化；link/.. 必须按操作系统的真实路径顺序解析。
    output = join(realpathSync.native(dirname(output)), basename(output));
    assertNotProtected(source); assertWritable(output);
    if (extname(source).toLowerCase() !== '.rp' || extname(output).toLowerCase() !== '.rp') throw new Error('source/output 必须是 .rp');
    const before = readRp(readFileSync(source));
    if (before.records.unparseable || before.counts.danglingRefs || before.counts.problems) throw new Error('源文件结构检查失败，拒绝 GUI job');
    // 宿主版本：显式参数 > 源文件版本。双版本并行时不能靠「第一个 Axure 进程」。
    const host = resolvePasteTarget({ version: version ?? before.version });
    try { copyFileSync(source, output, constants.COPYFILE_EXCL); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      throw Object.assign(new Error(`输出文件已存在，未覆盖：${output}。请换用新路径；若这是上次失败留下的文件，先核对失败记录与内容再删除重试。`), { code: 'EEXIST', path: output });
    }
    const copied = statSync(output);
    const id = randomUUID();
    const job = { id, type: 'gui-roundtrip', source, output, preview: Boolean(preview),
      host: { version: host.version, label: host.label, platform: process.platform, bundleId: process.platform === 'darwin' ? host.bundleId : undefined },
      status: 'queued', stdout: '', stderr: '', phase: 'queued', validation: null,
      outputCopy: { dev: copied.dev, ino: copied.ino, mtimeMs: copied.mtimeMs,
        sha256: createHash('sha256').update(readFileSync(output)).digest('hex') } };
    job.done = new Promise(resolveDone => { job.finish = resolveDone; });
    this.jobs.set(id, job);
    setImmediate(() => this.pump());
    if (wait) { await job.done; return this.get(id); }
    return this.get(id);
  }

  pump() {
    if (this.active) return;
    const job = [...this.jobs.values()].find(j => j.status === 'queued');
    if (!job) return;
    this.active = job.id;
    job.status = 'running';
    if (['generate-prototype', 'revise-prototype'].includes(job.type)) { this.pumpGeneration(job); return; }
    let originalMtime;
    try {
      assertNotProtected(job.output); assertWritable(job.output);
      originalMtime = statSync(job.output).mtimeMs;
      const runnerArgs = job.preview ? [job.output, String(job.host.version), 'preview'] : [job.output, String(job.host.version)];
      job.child = this.runner(runnerArgs);
      job.child.stdout.on('data', chunk => { job.stdout += chunk.toString(); });
      job.child.stderr.on('data', chunk => {
        job.stderr += chunk.toString();
        const phases = [...job.stderr.matchAll(/^AXURE_GUI_PHASE (opened|saved|closed|reopened|preview)/gm)];
        if (phases.length) job.phase = phases.at(-1)[1];
      });
      job.child.once('error', error => this.complete(job, 1, error.message));
      job.child.once('close', code => {
        if (job.status === 'cancelled') { this.complete(job, code); return; }
        try {
          assertNotProtected(job.output);
          const outBytes = readFileSync(job.output);
          const rp = readRp(outBytes);
          const gui = job.stdout.trim() === 'saved-closed-reopened';
          const saveCommandIssued = job.stderr.includes('AXURE_GUI_SAVE_COMMAND');
          job.outputSha256 = createHash('sha256').update(outBytes).digest('hex');
          job.validation = {
            structure: rp.records.unparseable === 0 && rp.counts.danglingRefs === 0 && rp.counts.problems === 0,
            // Windows 上未修改的文档可能被 Axure 跳过写盘；此时以保存命令已执行为准，
            // 是否真正写入仍由 mtimeChanged 记录。
            guiSaved: ((gui || job.stderr.includes('AXURE_GUI_PHASE saved')) && statSync(job.output).mtimeMs > originalMtime)
              || (process.platform === 'win32' && saveCommandIssued),
            saveCommandIssued,
            closed: gui || job.stderr.includes('AXURE_GUI_PHASE closed'),
            reopened: gui || job.stderr.includes('AXURE_GUI_PHASE reopened'),
            preview: Boolean(job.preview && job.stderr.includes('AXURE_GUI_PHASE preview')),
            guiEdited: false,
            counts: rp.counts
          };
          const passed = job.validation.structure && job.validation.guiSaved && job.validation.closed && job.validation.reopened;
          this.complete(job, code, code === 0 && !passed ? '没有确认结构健康及 GUI 保存、关闭、重开全部完成' : '');
        } catch (error) { this.complete(job, 1, error.message); }
      });
    } catch (error) { this.complete(job, 1, error.message); }
  }

  complete(job, code, error = '') {
    if (job.finished) return;
    job.finished = true;
    if (job.status !== 'cancelled') job.status = code === 0 && !error ? 'completed' : 'failed';
    if (error) job.stderr += error;
    if (job.status === 'failed') this.cleanupRoundtrip(job);
    job.exitCode = code;
    this.active = null;
    job.finish();
    setImmediate(() => this.pump());
  }

  cleanupRoundtrip(job) {
    if (job.type !== 'gui-roundtrip' || !job.outputCopy) return;
    if (job.phase !== 'queued' || /AXURE_GUI_(?:PHASE|DOCUMENT_OPENED)/.test(job.stderr)) {
      job.outputCleanup = { removed: false, reason: 'native-document-observed' };
      return;
    }
    try {
      const current = lstatSync(job.output), copied = job.outputCopy;
      const unchanged = current.isFile() && current.dev === copied.dev && current.ino === copied.ino
        && current.mtimeMs === copied.mtimeMs
        && createHash('sha256').update(readFileSync(job.output)).digest('hex') === copied.sha256;
      if (unchanged) unlinkSync(job.output);
      job.outputCleanup = { removed: unchanged, reason: unchanged ? 'unopened-copy-removed' : 'output-changed' };
    } catch (error) {
      job.outputCleanup = { removed: false, reason: error.code === 'ENOENT' ? 'already-absent' : 'cleanup-failed', ...(error.code === 'ENOENT' ? {} : { message: error.message }) };
    }
  }

  cancel(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`未知 job ${id}`);
    if (!['queued', 'running'].includes(job.status)) return { ...this.get(id), cancelled: false, reason: `already_${job.status}` };
    const running = job.status === 'running';
    job.status = 'cancelled';
    if (running) {
      if (['generate-prototype', 'revise-prototype'].includes(job.type) && process.platform !== 'win32') {
        try { process.kill(-job.child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      } else job.child.kill('SIGTERM');
    }
    else { this.cleanupRoundtrip(job); job.finished = true; job.finish(); }
    return { ...this.get(id), cancelled: true, reason: running ? 'termination_requested' : 'cancelled_queued' };
  }

  async close() {
    for (const job of this.jobs.values()) if (['queued', 'running'].includes(job.status)) this.cancel(job.id);
    await Promise.all([...this.jobs.values()].map(job => job.done));
  }
}
