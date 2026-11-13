// Windows 宿主往返校验：需要本机 Axure RP 9/11、桌面会话与空白模板；缺依赖时 SKIP。
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBlankTemplate } from '../scripts/blank-template.mjs';
import { windowsHostExecutable, windowsRoundtrip } from '../studio/axure-preview.mjs';

const skip = reason => { console.log(`SKIP Windows 宿主预览：${reason}`); process.exit(0); };
if (process.platform !== 'win32') skip('当前平台不是 win32');
const powershell = join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
if (!existsSync(powershell)) skip('找不到 Windows PowerShell');

const templates = {};
for (const version of [9, 11]) {
  try {
    windowsHostExecutable(version);
    templates[version] = resolveBlankTemplate(version);
  } catch (error) {
    skip(error.message.split('\n')[0]);
  }
}

let passed = 0;
for (const version of [9, 11]) {
  const work = mkdtempSync(join(tmpdir(), `rp-host-${version}-`));
  try {
    const file = join(work, `preview-check-${version}-${process.pid}.rp`);
    copyFileSync(templates[version], file);
    const host = await windowsRoundtrip(file, { version });
    assert.equal(host.opened, true, '宿主未打开自有文档');
    assert.equal(host.saveCommandIssued, true, '宿主未发出保存命令');
    assert.equal(host.closed, true, '宿主未关闭文档');
    assert.equal(host.reopened, true, '宿主未重开文档');
    assert.equal(host.previewVerified, true, '预览内容未包含本文档名');
    assert.match(host.previewUrl, /^http:\/\/127\.0\.0\.1:\d+\/start\.html$/);
    console.log(`PASS RP ${version} Windows 宿主往返 + 预览（${host.elapsedMs}ms，端口 ${host.port}，写盘 ${host.saved}）`);
    passed++;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ total: 2, passed }));
