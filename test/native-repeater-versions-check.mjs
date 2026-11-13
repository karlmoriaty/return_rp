#!/usr/bin/env node
// Native Repeater parity: the same RP/1 model must build on RP 9 and RP 11.
//
// This check needs a local Axure installation (Default.rplib), a blank project
// template for each target and Python with Pillow for the compiler stage.
// When any prerequisite is missing the check reports SKIP instead of failing,
// because the public CI image ships none of them.
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
const versions = [9, 11];

function skipReason() {
  const pillow = spawnSync('python3', ['-c', 'import PIL'], { encoding: 'utf8' });
  if (pillow.status !== 0) return 'python3 没有 Pillow，跳过原生中继器构建';
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

const specText = target => [
  `rp/1 name="中继器对齐" target=${target} domain=web theme=enterprise-light`,
  'model Order id=id title=text status="enum(已支付,待跟进)"',
  'dataset orders model=Order',
  '  - id="1" title="甲" status="已支付"',
  '  - id="2" title="乙" status="待跟进"',
  '  - id="3" title="丙" status="已支付"',
  'page #p [800x600a] name="页"',
  '  @column #root [800x600] padding=20 gap=12 fill=$bg',
  '    @repeater #rows [760x400] dataset=orders rowHeight=48',
  '      :template',
  '        @row #r [760x48] gap=8',
  '          @label #rt [400x24] "=item.title"',
  '',
].join('\n');

function run(file, args, cwd) {
  const result = spawnSync(process.execPath, [file, ...args], { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `${file} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function repeaters(buffer) {
  const found = [];
  for (const record of readRecords(buffer).filter(record => record.className === 'Axure:Page')) {
    const graph = parsePayload(record);
    for (const object of graph.objects.values()) {
      if (object.className !== 'Axure:DiagramObject:Repeater') continue;
      const data = graph.objects.get(field(object.body, 'Data').value);
      found.push({
        columns: field(data.body, 'columns').items.length,
        rows: field(data.body, 'rows').items.length,
        rowRoots: field(graph.objects.get(field(object.body, 'BaseDiagram').value).body, 'diagram-objects').items.length,
      });
    }
  }
  return found;
}

const work = mkdtempSync(join(tmpdir(), 'rp-repeater-versions-'));
let checked = 0;
try {
  for (const version of versions) {
    const dir = join(work, `rp${version}`);
    mkdirSync(dir, { recursive: true });
    const spec = join(dir, 'rows.rp1');
    const out = join(dir, 'out');
    const file = join(dir, `repeater-rp${version}.rp`);
    writeFileSync(spec, specText(version), 'utf8');
    run(join(ROOT, 'scripts/proto.mjs'), ['compile', '--spec', spec, '--out-dir', out, '--no-interactions'], dir);
    run(join(ROOT, 'scripts/proto.mjs'), ['build-rp', '--plan', join(out, 'compile-plan.json'), '--out', file, '--backend', 'native'], dir);

    const buffer = readFileSync(file);
    assert.equal(buffer.readUInt16LE(2), version, `输出文件头版本应为 ${version}`);
    const summary = readRp(buffer);
    assert.equal(summary.counts.problems, 0, `RP ${version} 结构问题：${JSON.stringify(summary.problems)}`);
    assert.equal(summary.counts.danglingRefs, 0, `RP ${version} 悬空引用`);
    const found = repeaters(buffer);
    assert.equal(found.length, 1, `RP ${version} 应生成 1 个中继器`);
    assert.equal(found[0].columns, 3, `RP ${version} 中继器列数`);
    assert.equal(found[0].rows, 3, `RP ${version} 中继器行数`);
    assert.ok(found[0].rowRoots > 0, `RP ${version} 中继器缺少行模板元件`);
    checked++;
    console.log(`PASS  RP ${version} native Repeater keeps model columns/rows and zero structural problems`);
  }
  console.log(JSON.stringify({ total: checked, passed: checked }));
} finally { rmSync(work, { recursive: true, force: true }); }
