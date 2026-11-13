// RP 9 / RP 11 工具能力对齐检查。
//
// 规则（用户口径）：RP 9 能做的必须多于或等于 RP 11。
//   - RP 11 标记 supported 的能力，RP 9 必须是 supported 或 explicit-diagnostic；
//   - explicit-diagnostic 必须在源码里留有可搜索的拒绝文案；
//   - RP 9 独有能力（表单状态样式、中继器、面板注册链、Studio 局部创作、自动预览、
//     图片离线生成）必须保留，不能被后续 RP 11 改动顺手删掉。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSION_FEATURES, FEATURE_STATUSES, PARITY_RULE,
  rp9ParityViolations, rp9ExclusiveFeatures, DIAGNOSTIC_EVIDENCE, featureById,
} from '../scripts/version-capabilities.mjs';
import { DEFAULT_VERSION, supportedVersions } from '../scripts/version.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
let checks = 0;
const ok = (name, fn) => {
  try { fn(); checks++; console.log(`PASS  ${name}`); }
  catch (error) { console.log(`FAIL  ${name} — ${error.message}`); process.exitCode = 1; throw error; }
};

ok('parity rule is RP9_SUPERSET_OF_RP11', () => assert.equal(PARITY_RULE, 'RP9_SUPERSET_OF_RP11'));

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

ok('RP 9 is a superset of RP 11 (no silent RP 9 gap)', () => {
  const violations = rp9ParityViolations();
  assert.deepEqual(violations.map(item => `${item.id} (rp11=${item.rp11}, rp9=${item.rp9})`), []);
});

ok('explicit diagnostics are documented and implemented', () => {
  for (const item of VERSION_FEATURES) {
    if (item.rp9 !== 'explicit-diagnostic') continue;
    assert.ok(item.note, `${item.id}: explicit-diagnostic 必须写 note`);
    const evidence = DIAGNOSTIC_EVIDENCE[item.id];
    assert.ok(evidence, `${item.id}: 缺少 DIAGNOSTIC_EVIDENCE`);
    const source = readFileSync(join(ROOT, evidence.file), 'utf8');
    assert.ok(source.includes(evidence.text), `${item.id}: ${evidence.file} 里找不到「${evidence.text}」`);
  }
});

ok('diagnostic evidence has no orphan entries', () => {
  for (const id of Object.keys(DIAGNOSTIC_EVIDENCE)) {
    const item = featureById(id);
    assert.ok(item, `DIAGNOSTIC_EVIDENCE.${id} 没有对应能力项`);
    assert.equal(item.rp9, 'explicit-diagnostic', `${id}: 有诊断证据但不是 explicit-diagnostic`);
  }
});

ok('RP 9 exclusive capabilities are retained', () => {
  const ids = new Set(rp9ExclusiveFeatures().map(item => item.id));
  for (const id of ['native-form-state-styles', 'native-repeater', 'panel-registry',
    'studio-rp1-local', 'axure-preview', 'offline-image-generate']) {
    assert.ok(ids.has(id), `RP 9 独有能力丢失：${id}`);
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
