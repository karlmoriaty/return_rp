// RP 9 / RP 11 工具能力对齐检查。
//
// 规则（1.2.0 起的双向口径）：
//   - 任一版本 supported 的能力，另一版本不能是 unsupported；
//   - 所有缺口必须登记在 DOCUMENTED_GAPS，并与矩阵状态一致；
//   - explicit-diagnostic / partial 必须在源码里留有可搜索的文案；
//   - 之前只在 RP 9 侧存在的能力（表单状态样式、中继器、面板注册链、Studio 局部创作、
//     自动预览、图片离线生成）必须有同等或更高级别的登记，不能被后续改动顺手删掉。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSION_FEATURES, FEATURE_STATUSES, PARITY_RULE, DOCUMENTED_GAPS,
  rp9ParityViolations, rp11ParityViolations, parityViolations, documentedGaps,
  DIAGNOSTIC_EVIDENCE, featureById,
} from '../scripts/version-capabilities.mjs';
import { DEFAULT_VERSION, supportedVersions } from '../scripts/version.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let checks = 0;
const ok = (name, fn) => {
  try { fn(); checks++; console.log(`PASS  ${name}`); }
  catch (error) { console.log(`FAIL  ${name} — ${error.message}`); process.exitCode = 1; throw error; }
};

ok('parity rule is SYMMETRIC_PARITY', () => assert.equal(PARITY_RULE, 'SYMMETRIC_PARITY'));

ok('feature ids are unique', () => {
  const ids = VERSION_FEATURES.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

ok('every feature uses a known status for both versions', () => {
  for (const item of VERSION_FEATURES) {
    assert.ok(FEATURE_STATUSES.includes(item.rp9), `${item.id}: rp9=${item.rp9}`);
    assert.ok(FEATURE_STATUSES.includes(item.rp11), `${item.id}: rp11=${item.rp11}`);
    assert.ok(item.label && item.label.length > 0, `${item.id}: 缺少 label`);
  }
});

ok('no capability is unsupported on either side', () => {
  const unsupported = VERSION_FEATURES.filter(item => item.rp9 === 'unsupported' || item.rp11 === 'unsupported');
  assert.deepEqual(unsupported.map(item => item.id), []);
});

ok('parity has no two-way violations', () => {
  assert.deepEqual(rp9ParityViolations().map(item => `${item.id} (rp11=${item.rp11}, rp9=${item.rp9})`), []);
  assert.deepEqual(rp11ParityViolations().map(item => `${item.id} (rp9=${item.rp9}, rp11=${item.rp11})`), []);
  assert.deepEqual(parityViolations().map(item => item.id), []);
});

ok('documented gaps match the matrix exactly', () => {
  const keys = documentedGaps().map(gap => gap.key).sort();
  assert.deepEqual(keys, Object.keys(DOCUMENTED_GAPS).sort());
  for (const gap of documentedGaps()) {
    const entry = DOCUMENTED_GAPS[gap.key];
    assert.equal(entry.status, gap.status, `${gap.key}: 状态与矩阵不一致`);
    assert.ok(entry.reason && entry.reason.length > 0, `${gap.key}: 缺少 reason`);
  }
});

ok('diagnostic evidence is present in source and never orphaned', () => {
  for (const [key, evidence] of Object.entries(DIAGNOSTIC_EVIDENCE)) {
    const [id, version = 'rp9'] = key.split(':');
    const gapKey = `${id}:${version}`;
    const item = featureById(id);
    assert.ok(item, `${key}: 没有对应能力项`);
    assert.ok(['explicit-diagnostic', 'partial'].includes(item[version]), `${key}: 有诊断证据但状态是 ${item[version]}`);
    assert.ok(DOCUMENTED_GAPS[gapKey], `${key}: 有诊断证据但未登记为缺口`);
    const source = readFileSync(join(ROOT, evidence.file), 'utf8');
    assert.ok(source.includes(evidence.text), `${key}: ${evidence.file} 里找不到「${evidence.text}」`);
  }
  for (const gap of documentedGaps()) {
    if (!['explicit-diagnostic', 'partial'].includes(gap.status)) continue;
    assert.ok(DIAGNOSTIC_EVIDENCE[gap.key] || DIAGNOSTIC_EVIDENCE[gap.id], `${gap.key}: ${gap.status} 缺少 DIAGNOSTIC_EVIDENCE`);
  }
});

ok('RP 9 legacy capabilities keep an equal-or-better RP 11 registration', () => {
  for (const id of ['native-form-state-styles', 'native-repeater', 'panel-registry',
    'studio-rp1-local', 'axure-preview', 'offline-image-generate']) {
    const item = featureById(id);
    assert.ok(item, `能力丢失：${id}`);
    assert.equal(item.rp9, 'supported', `${id}: RP 9 侧必须保持 supported`);
    assert.ok(['supported', 'partial', 'explicit-diagnostic', 'gui-only', 'not-applicable'].includes(item.rp11), `${id}: RP 11 侧状态 ${item.rp11} 未登记`);
  }
});

ok('default target stays RP 11 and both versions remain supported', () => {
  assert.equal(DEFAULT_VERSION, 11);
  assert.deepEqual(supportedVersions(), [9, 11]);
});

ok('RP 9 support is complete for shared core writers', () => {
  for (const id of ['rp1-native-compile', 'native-scene', 'blank-project-trim', 'panel-clone',
    'fill-panel-state', 'adaptive-views', 'interactions-core', 'repeater-data-ops']) {
    assert.equal(featureById(id)?.rp9, 'supported', `${id} 在 RP 9 上必须是 supported`);
  }
});

console.log(JSON.stringify({ total: checks, passed: checks }));
