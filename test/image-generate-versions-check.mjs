#!/usr/bin/env node
// Image -> native .rp parity: generate_from_image must write an editable binary
// project on RP 9 and RP 11 without a GUI paste step, with the same widget set.
//
// Needs Python + Pillow and a local Axure 9/11 install (Default.rplib + blank
// template). Reports SKIP when any prerequisite is missing.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callCommandTool } from '../scripts/mcp-tools.mjs';
import { installRoot } from '../scripts/version.mjs';
import { resolveBlankTemplate } from '../scripts/blank-template.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGE = join(ROOT, 'examples/screenshot/source.png');

function skipReason() {
  const pillow = spawnSync('python3', ['-c', 'import PIL'], { encoding: 'utf8' });
  if (pillow.status !== 0) return 'python3 没有 Pillow，跳过图片生成构建';
  for (const version of [9, 11]) {
    const library = join(installRoot(version), 'Libraries/Default.rplib');
    if (!existsSync(library)) return `缺少 Axure RP ${version} Default.rplib：${library}`;
    try { resolveBlankTemplate(version); }
    catch { return `缺少 Axure RP ${version} 空白模板（设置 AXURE_BLANK_TEMPLATE_RP${version}）`; }
  }
  return null;
}

const reason = skipReason();
if (reason) {
  console.log(`SKIP  ${reason}`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), 'rp-image-versions-'));
try {
  const results = {};
  for (const version of [9, 11]) {
    const output = join(work, `image-rp${version}.rp`);
    const tool = callCommandTool('generate_from_image', { image: IMAGE, output, version, scale: 2 });
    const result = tool.structuredContent ?? tool;
    assert.equal(result.status, 'completed', `RP ${version} 图片生成失败：${result.code} ${result.message}`);
    assert.equal(result.backend, `rp${version}-native-scene`);
    assert.equal(result.version, version);
    assert.deepEqual(result.structure, { unparseable: 0, danglingRefs: 0, problems: 0 });
    assert.equal(readFileSync(output).readUInt16LE(2), version, `输出文件头应为 RP ${version}`);
    results[version] = result;
  }
  assert.equal(results[9].counts.widgets, results[11].counts.widgets,
    'RP 9 与 RP 11 应生成相同数量的原生元件');
  assert.ok(results[9].counts.widgets > 0, '图片生成不应产出空页面');
  console.log(`PASS  RP 9 / RP 11 图片离线生成一致（${results[9].counts.widgets} 个元件，零结构问题）`);
  console.log(JSON.stringify({ total: 1, passed: 1 }));
} finally { rmSync(work, { recursive: true, force: true }); }
