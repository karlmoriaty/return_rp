#!/usr/bin/env node
// Repeater action parity: removeAll / comboType / rowIndices must write the same
// intent on RP 9 and RP 11.
//
// RP 9 has no remove-all-sorts / FilterComboType / RowIndicesText keys:
//   - removeAll  -> extra RemoveSortFromRepeaterAction(remove-all) before the sort
//   - comboType  -> dropped with a named adaptation (single-condition filters are AND)
//   - rowIndices -> rewritten as a TargetItem.index rule
// This check builds one RP/1 model per version, writes the three actions and
// inspects the resulting native records.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installRoot } from '../scripts/version.mjs';
import { resolveBlankTemplate } from '../scripts/blank-template.mjs';
import { addInteractions } from '../scripts/ix-actions.mjs';
import { readRp } from '../scripts/rp-read.mjs';
import { readRecords } from '../scripts/rp-records.mjs';
import { parsePayload, field } from '../scripts/parse-payload.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const versions = [9, 11];

function skipReason() {
  const pillow = spawnSync('python3', ['-c', 'import PIL'], { encoding: 'utf8' });
  if (pillow.status !== 0) return 'python3 没有 Pillow，跳过中继器动作对齐构建';
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

const specText = version => [
  `rp/1 name="中继器动作对齐" target=${version} domain=web theme=enterprise-light`,
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

const props = (graph, node) => new Map(node.body.entries.map(([key, value]) => [key.text, value]));
const literalTexts = graph => [...graph.objects.values()]
  .filter(object => object.className === 'Axure:Expr:StringLiteral')
  .map(object => field(object.body, 'value')?.text);

const work = mkdtempSync(join(tmpdir(), 'rp-repeater-actions-'));
let checked = 0;
try {
  for (const version of versions) {
    const dir = join(work, `rp${version}`);
    mkdirSync(dir, { recursive: true });
    const spec = join(dir, 'rows.rp1');
    const out = join(dir, 'out');
    const file = join(dir, `repeater-actions-rp${version}.rp`);
    writeFileSync(spec, specText(version), 'utf8');
    run(join(ROOT, 'scripts/proto.mjs'), ['compile', '--spec', spec, '--out-dir', out, '--no-interactions'], dir);
    run(join(ROOT, 'scripts/proto.mjs'), ['build-rp', '--plan', join(out, 'compile-plan.json'), '--out', file, '--backend', 'native'], dir);

    const built = readFileSync(file);
    assert.equal(built.readUInt16LE(2), version, `输出文件头版本应为 ${version}`);
    const pageRecord = readRecords(built).find(record => record.className === 'Axure:Page');
    const pageGraph = parsePayload(pageRecord);
    const repeater = [...pageGraph.objects.values()]
      .find(object => object.className === 'Axure:DiagramObject:Repeater');
    assert.ok(repeater, `RP ${version} 缺少中继器`);
    const repeaterName = field(field(repeater.body, 'name-block'), 'text')?.text;

    const result = addInteractions(built, { page: '页', widget: repeaterName }, [{
      event: 'OnClick',
      cases: [{ actions: [
        { type: 'repeater-sort', target: repeaterName, column: 'title', ascending: true, removeAll: true },
        { type: 'repeater-filter', target: repeaterName, column: 'status', filter: '已支付', comboType: 2 },
        { type: 'repeater-delete-items', target: repeaterName, rowIndices: '2' },
      ] }],
    }], { replaceEvent: true });

    const summary = readRp(result.file);
    assert.equal(summary.counts.problems, 0, `RP ${version} 结构问题：${JSON.stringify(summary.problems)}`);
    assert.equal(summary.counts.danglingRefs, 0, `RP ${version} 悬空引用`);

    const graph = parsePayload(readRecords(result.file).find(record => record.index === result.report.record));
    const byClass = name => [...graph.objects.values()].filter(object => object.className === name);
    const sortInfo = props(graph, byClass('Axure:AddSortToRepeaterInfo')[0]);
    const filterInfo = props(graph, byClass('Axure:AddFilterToRepeaterInfo')[0]);
    const deleteInfo = props(graph, byClass('Axure:DeleteItemsFromDataSetInfo')[0]);
    const removes = byClass('Axure:RemoveSortFromRepeaterInfo');

    if (version === 9) {
      assert.equal(sortInfo.has('remove-all-sorts'), false, 'RP 9 sort 不应写 remove-all-sorts');
      assert.equal(removes.length, 1, 'RP 9 应补一个 remove-sort 动作');
      assert.equal(props(graph, removes[0]).get('remove-all')?.value, true, 'RP 9 remove-sort 必须清除全部');
      assert.equal(filterInfo.has('FilterComboType'), false, 'RP 9 filter 不应写 FilterComboType');
      assert.equal(deleteInfo.has('RowIndicesText'), false, 'RP 9 delete 不应写 RowIndicesText');
      assert.ok(literalTexts(graph).some(text => text?.includes('TargetItem.index == 2')),
        'RP 9 delete 规则应改写为 TargetItem.index');
      assert.ok(result.report.versionAdaptations.some(text => text.includes('remove-sort(remove-all)')));
      assert.ok(result.report.versionAdaptations.some(text => text.includes('comboType 在 RP 9 上无对应键')));
      assert.ok(result.report.versionAdaptations.some(text => text.includes('TargetItem.index 规则')));
      assert.equal(result.report.interactions[0].cases[0].actions.length, 4, 'RP 9 报告应列出拆分后的 4 个动作');
    } else {
      assert.equal(sortInfo.get('remove-all-sorts')?.value, true, 'RP 11 sort 必须写 remove-all-sorts');
      assert.equal(removes.length, 0, 'RP 11 不应拆出 remove-sort 动作');
      assert.equal(filterInfo.get('FilterComboType')?.value, 2, 'RP 11 filter 必须写 FilterComboType');
      assert.equal(deleteInfo.get('RowIndicesText')?.text, '2', 'RP 11 delete 必须写 RowIndicesText');
      assert.equal(result.report.interactions[0].cases[0].actions.length, 3, 'RP 11 报告应列出 3 个动作');
    }
    checked++;
    console.log(`PASS  RP ${version} removeAll / comboType / rowIndices keep their intent`);
  }
  console.log(JSON.stringify({ total: checked, passed: checked }));
} finally { rmSync(work, { recursive: true, force: true }); }
