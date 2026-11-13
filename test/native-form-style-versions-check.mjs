#!/usr/bin/env node
// Native form state styles: the same RP/1 form model must serialize on RP 9 and RP 11.
//
// Needs a local Axure installation, blank templates for both targets and Python
// with Pillow. Missing prerequisites produce SKIP so public CI keeps passing.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installRoot } from '../scripts/version.mjs';
import { resolveBlankTemplate } from '../scripts/blank-template.mjs';
import { readRp } from '../scripts/rp-read.mjs';
import { readRecords } from '../scripts/rp-records.mjs';
import { parsePayload, field } from '../scripts/parse-payload.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'examples/rp-language/native-forms.rp1');
const versions = [9, 11];
const STATE_NAMES = ['MouseOver', 'Selected', 'Disabled', 'Focused'];

function skipReason() {
  const pillow = spawnSync('python3', ['-c', 'import PIL'], { encoding: 'utf8' });
  if (pillow.status !== 0) return 'python3 没有 Pillow，跳过原生表单构建';
  for (const version of versions) {
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

function run(args, cwd) {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts/proto.mjs'), ...args], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `proto.mjs ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
}

function inspect(buffer) {
  const summary = readRp(buffer);
  const states = [];
  let widgets = 0;
  for (const record of readRecords(buffer).filter(record => record.className === 'Axure:Page')) {
    const graph = parsePayload(record);
    for (const object of graph.objects.values()) {
      if (object.className.startsWith('Axure:DiagramObject:')) widgets++;
      if (object.className !== 'Axure:Style') continue;
      const name = field(object.body, 'style-name')?.text;
      if (STATE_NAMES.includes(name)) states.push(name);
    }
  }
  return { version: buffer.readUInt16LE(2), summary, widgets, states };
}

const work = mkdtempSync(join(tmpdir(), 'rp-form-style-versions-'));
const observed = [];
try {
  for (const version of versions) {
    const dir = join(work, `rp${version}`);
    mkdirSync(dir, { recursive: true });
    const spec = join(dir, 'forms.rp1');
    const out = join(dir, 'out');
    const file = join(dir, `forms-rp${version}.rp`);
    const source = readFileSync(SOURCE, 'utf8').replace(/^rp\/1[^\n]*/, `rp/1 target=${version} name="原生表单与状态样式" domain=web theme=enterprise-light`);
    writeFileSync(spec, source, 'utf8');
    run(['compile', '--spec', spec, '--out-dir', out], dir);
    run(['build-rp', '--plan', join(out, 'compile-plan.json'), '--out', file, '--backend', 'native'], dir);

    const result = inspect(readFileSync(file));
    assert.equal(result.version, version, `输出文件头版本应为 ${version}`);
    for (const key of ['danglingRefs', 'sentinelSlotsNonZero', 'problems']) assert.equal(result.summary.counts[key], 0, `RP ${version} ${key}`);
    assert.equal(result.widgets, 56, `RP ${version} 原生表单元件数`);
    assert.equal(result.states.length, 19, `RP ${version} 状态样式数：${JSON.stringify(result.states)}`);
    for (const name of STATE_NAMES) assert.ok(result.states.includes(name), `RP ${version} 缺少 ${name} 状态样式`);
    observed.push({ widgets: result.widgets, states: result.states.length });
    console.log(`PASS  RP ${version} native form widgets keep 19 state styles and zero structural problems`);
  }
  assert.deepEqual(observed[0], observed[1], 'RP 9 与 RP 11 的表单状态样式数量必须一致');
  console.log(JSON.stringify({ total: observed.length, passed: observed.length }));
} finally { rmSync(work, { recursive: true, force: true }); }
