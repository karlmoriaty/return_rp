import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { exportStudioDocumentToRp } from './export-rp.mjs';
import { versionSpec } from '../scripts/version.mjs';

const run = promisify(execFile);
const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

async function axurePorts() {
  const { stdout } = await run('/usr/sbin/lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
  return new Set(stdout.split('\n').filter(line => /^Axure/.test(line)).flatMap(line => [...line.matchAll(/127\.0\.0\.1:(\d+)/g)].map(m => Number(m[1]))));
}

// Windows 安装路径既可能是安装目录，也可能直接是 exe；未配置环境变量时按常见布局查找。
export function windowsHostExecutable(version) {
  const exe = `AxureRP${version}.exe`;
  const spec = versionSpec(version);
  const roots = [process.env[`AXURE_APP_RP${version}`], spec.appPath].filter(Boolean);
  const candidates = [
    ...roots.flatMap(root => [root, join(root, exe)]),
    `C:/Program Files/Axure/Axure RP ${version}/${exe}`,
    `C:/Program Files/Axure RP ${version}/${exe}`,
    `C:/Program Files (x86)/Axure/Axure RP ${version}/${exe}`
  ];
  const found = candidates.find(path => /\.exe$/i.test(path) && existsSync(path));
  if (!found) throw Object.assign(new Error(`未找到本机 Axure RP ${version} 可执行文件；设置 AXURE_APP_RP${version} 指向 ${exe}`), { code: 'E_AXURE_HOST_UNAVAILABLE' });
  return found;
}

const lastJsonLine = text => {
  const line = String(text ?? '').trim().split(/\r?\n/).filter(Boolean).pop();
  try { return line ? JSON.parse(line) : null; } catch { return null; }
};

// Windows 宿主：打开自有副本 -> 保存 -> 关闭 -> 重开 -> F5 预览，预览地址必须包含本文档名。
export async function windowsRoundtrip(file, { version, timeout = 180000 } = {}) {
  const exe = windowsHostExecutable(version);
  const powershell = join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  let stdout;
  try {
    ({ stdout } = await run(powershell, ['-NoProfile', '-NonInteractive', '-File', join(scriptsDir, 'axure-host.ps1'),
      '-File', file, '-Exe', exe, '-Title', basename(file, extname(file))], { timeout, windowsHide: true }));
  } catch (error) {
    const host = lastJsonLine(error.stdout);
    throw Object.assign(new Error(host?.error || error.message), { code: 'E_AXURE_HOST_ROUNDTRIP', host });
  }
  const host = lastJsonLine(stdout);
  if (!host?.previewVerified) throw Object.assign(new Error('Windows 宿主未返回可验证的预览地址'), { code: 'E_AXURE_HOST_ROUNDTRIP', host });
  return host;
}

// Opens only a new, owned export. A fresh preview server is mandatory so an old
// tab or an unrelated document can never supply a passing native result.
export async function prepareAxurePreview(doc, directory, { projectDir = null } = {}) {
  const target = Number(doc.target || 9);
  if (![9, 11].includes(target)) throw Object.assign(new Error(`自动 Axure 预览只接受目标版本 9 或 11，收到 ${doc.target}`), { code: 'E_AXURE_HOST_UNAVAILABLE' });
  const platform = process.platform;
  if (platform !== 'darwin' && platform !== 'win32') throw Object.assign(new Error('自动 Axure 预览需要 macOS 或 Windows 桌面会话'), { code: 'E_AXURE_HOST_UNAVAILABLE' });
  mkdirSync(directory, { recursive: true });
  const before = platform === 'darwin' ? await axurePorts() : null;
  const source = join(directory, 'scenario-source.rp');
  const exported = await exportStudioDocumentToRp(doc, { outRpPath: source, projectDir });
  const attempts = [];
  let host;
  let owned;
  for (let attempt = 1; attempt <= 2; attempt++) {
    owned = join(directory, `scenario-host-${Date.now()}-${attempt}.rp`);
    copyFileSync(source, owned);
    try {
      if (platform === 'win32') {
        const result = await windowsRoundtrip(owned, { version: target });
        host = { stdout: JSON.stringify(result), stderr: '', result };
        attempts.push({ owned, passed: true, host: result });
        writeFileSync(join(directory, 'host-roundtrip.json'), JSON.stringify({ source, owned, contentHash: doc.contentHash, attempts }, null, 2));
        return { url: result.previewUrl, source, owned, contentHash: doc.contentHash,
          threeZerosPassed: exported.report.summary.threeZerosPassed,
          hostSavedClosedReopened: Boolean(result.closed && result.reopened), attempts: attempts.length };
      }
      host = await run('/usr/bin/swift', [join(scriptsDir, 'gui-roundtrip.swift'), owned, String(target), 'preview'], { timeout: 45000 });
      attempts.push({ owned, passed: true, stdout: host.stdout, stderr: host.stderr });
      break;
    } catch (error) {
      attempts.push({ owned, passed: false, stdout: error.stdout, stderr: error.stderr, message: error.message, host: error.host });
      writeFileSync(join(directory, 'host-roundtrip.json'), JSON.stringify({ source, contentHash: doc.contentHash, attempts }, null, 2));
      if (attempt === 2) throw error;
    }
  }
  writeFileSync(join(directory, 'host-roundtrip.json'), JSON.stringify({ source, owned, stdout: host.stdout, stderr: host.stderr, contentHash: doc.contentHash, attempts }, null, 2));
  let ports = [];
  const deadline = Date.now() + 10000;
  do {
    ports = [...await axurePorts()].filter(port => !before.has(port));
    if (!ports.length) await new Promise(resolve => setTimeout(resolve, 100));
  } while (!ports.length && Date.now() < deadline);
  if (ports.length !== 1) throw Object.assign(new Error('无法唯一定位本次新生成的 Axure 预览端口'), { code: 'E_AXURE_PREVIEW_AMBIGUOUS' });
  // Let Axure open its first page. Display names are not exported filenames
  // (spaces and other characters are normalized by the host).
  return { url: `http://127.0.0.1:${ports[0]}/start.html`,
    source, owned, contentHash: doc.contentHash, threeZerosPassed: exported.report.summary.threeZerosPassed,
    hostSavedClosedReopened: host.stdout.includes('saved-closed-reopened'), attempts: attempts.length };
}
