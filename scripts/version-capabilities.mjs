// Axure RP 9 / RP 11 工具能力矩阵。
//
// 定位（1.2.0 起）：双向对齐。任一版本已 supported 的能力，另一版本不能是
// unsupported——至少要有同等级支持、明确诊断（explicit-diagnostic）、
// 部分实现（partial，带具名告警）或 GUI 路径（gui-only）。
// 测试 test/version-parity-check.mjs 会强制这条规则，并要求所有缺口登记在
// DOCUMENTED_GAPS 里，防止实现与文档悄悄漂移。
//
// 状态含义：
//   supported            本工具在该版本有完整写入/读取路径
//   partial              结构已写入，但具名子能力被跳过并在运行时告警
//   explicit-diagnostic  Axure 该版本没有对应原生结构；写入前明确报错，绝不静默降级
//   gui-only             只能借助 Axure GUI 完成，不做离线二进制写入
//   unsupported          本工具在该版本不提供
//   not-applicable       该版本没有这个原生模型
//
// 新增版本分支时，必须同时在这里登记；只有注释没有矩阵项会被对齐测试判失败。
export const PARITY_RULE = 'SYMMETRIC_PARITY';

const feature = (id, label, rp9, rp11, note = '') => ({ id, label, rp9, rp11, note });

export const VERSION_FEATURES = [
  feature('rp1-native-compile', 'RP/1 原生编译', 'supported', 'supported'),
  feature('native-scene', '场景写入原生页面', 'supported', 'supported'),
  feature('blank-project-trim', '空白工程模板检测与裁剪', 'supported', 'supported'),
  feature('panel-clone', '克隆原生动态面板', 'supported', 'supported'),
  feature('fill-panel-state', '面板状态内容装配', 'supported', 'supported'),
  feature('panel-registry', '面板注册链修复', 'supported', 'not-applicable',
    'RP 11 没有 DynamicPanelInfo / PanelDiagramInfo 模型'),
  feature('native-form-controls', '原生表单控件克隆', 'supported', 'supported'),
  feature('native-form-state-styles', '原生表单状态样式', 'supported', 'supported',
    '两版 Axure:Style 结构一致，按目标版本读取本机 DefaultStyle'),
  feature('native-repeater', '原生中继器', 'supported', 'supported',
    'RP 9 / RP 11 各自从本机 Default.rplib 克隆结构等价的中继器'),
  feature('adaptive-views', '自适应视图', 'supported', 'supported',
    'RP 9 原生没有 Cursor 字段，按目标版本逐字段写出'),
  feature('interactions-core', '核心交互与动作', 'supported', 'supported'),
  feature('repeater-data-ops', '中继器数据操作', 'supported', 'supported'),
  feature('fade-scale-anchor', '显示/切换的缩放与锚点', 'explicit-diagnostic', 'supported',
    'RP 9 的 FadeWidgetInfo 没有 scale / scale-hide / scale-anchor / scale-hide-anchor'),
  feature('toggle-enabled', '切换启用状态', 'explicit-diagnostic', 'supported',
    'RP 9 的 EnableDisableWidgetsInfo.enable 是 bool，只有启用/禁用'),
  feature('apply-style', '应用样式动作', 'explicit-diagnostic', 'supported',
    'RP 9 没有 InteractionApplyStyle / InteractionApplyStyleInfo 类型'),
  feature('rp11-only-events', 'RP 11 专属事件', 'explicit-diagnostic', 'supported',
    'OnErrorSet / OnErrorRemoved / OnBeforeItemLoad 在 RP 9 运行时不存在'),
  feature('rp11-only-fcalls', 'RP 11 专属表达式函数', 'explicit-diagnostic', 'supported',
    'ToLowerCase / GetErrorState / SetErrorState 不在 RP 9 运行时函数表里'),
  feature('repeater-sort-remove-all', '清除其他排序', 'supported', 'supported',
    'RP 9 拆为前置 remove-sort(remove-all) 动作，RP 11 写 remove-all-sorts 键'),
  feature('repeater-filter-combo-type', '过滤组合类型', 'partial', 'supported',
    'RP 9 无 FilterComboType 键；单条件动作按顺序过滤（AND），组合类型无可观察差异'),
  feature('repeater-delete-row-indices', '按行号删除中继器行', 'partial', 'supported',
    'RP 9 改写为 TargetItem.index 规则；结构已验证，运行时待 RP 9 预览实测'),
  feature('studio-rp1-local', 'Studio 局部 RP/1 创作', 'supported', 'supported',
    '按当前文档 target 包装片段，9 / 11 同一套校验'),
  feature('axure-preview', '自动 Axure 预览', 'supported', 'supported',
    'macOS 走 Swift 宿主（RP 9 实测），Windows 走 PowerShell 宿主（RP 9 / RP 11 均实测往返与预览）'),
  feature('offline-image-generate', '图片离线生成原生工程', 'supported', 'supported',
    '两版都离线写二进制 .rp；RP 11 使用本机空白模板，guiPaste 仍可显式选择'),
  feature('cli-mcp', 'CLI / MCP 入口', 'supported', 'supported'),
  feature('version-lint', '版本专属键 lint', 'supported', 'supported'),
];

export const FEATURE_STATUSES = ['supported', 'partial', 'explicit-diagnostic', 'gui-only', 'unsupported', 'not-applicable'];

// 已登记的缺口。键为 `${featureId}:rp9|rp11`，值为缺口状态与理由。
// 对齐测试要求矩阵里的每个非 supported 项恰好落在这里，且这里没有孤儿项。
export const DOCUMENTED_GAPS = {
  'panel-registry:rp11': { status: 'not-applicable', reason: 'RP 11 没有 DynamicPanelInfo / PanelDiagramInfo 模型' },
  'fade-scale-anchor:rp9': { status: 'explicit-diagnostic', reason: 'RP 9 FadeWidgetInfo 无 scale / anchor' },
  'toggle-enabled:rp9': { status: 'explicit-diagnostic', reason: 'RP 9 enable 只有布尔启用/禁用' },
  'apply-style:rp9': { status: 'explicit-diagnostic', reason: 'RP 9 无 InteractionApplyStyle 类型' },
  'rp11-only-events:rp9': { status: 'explicit-diagnostic', reason: 'RP 9 运行时没有这些事件' },
  'rp11-only-fcalls:rp9': { status: 'explicit-diagnostic', reason: 'RP 9 函数表没有这些表达式函数' },
  'repeater-filter-combo-type:rp9': { status: 'partial', reason: 'RP 9 无 FilterComboType；单条件动作按顺序过滤（AND）' },
  'repeater-delete-row-indices:rp9': { status: 'partial', reason: 'RP 9 改写为 TargetItem.index 规则，运行时待预览实测' },
};

export function featureById(id) {
  return VERSION_FEATURES.find(item => item.id === id) ?? null;
}

// RP 11 支持、RP 9 既未实现也无诊断的能力。
export function rp9ParityViolations() {
  return VERSION_FEATURES.filter(item => item.rp11 === 'supported' && item.rp9 === 'unsupported');
}

// RP 9 支持、RP 11 既未实现也无诊断的能力（1.2.0 新增：双向对齐）。
export function rp11ParityViolations() {
  return VERSION_FEATURES.filter(item => item.rp9 === 'supported' && item.rp11 === 'unsupported');
}

export function parityViolations() {
  return [...rp9ParityViolations(), ...rp11ParityViolations()];
}

// 旧接口保留：RP 9 完整支持、RP 11 仍有缺口的能力。
export function rp9ExclusiveFeatures() {
  return VERSION_FEATURES.filter(item =>
    item.rp9 === 'supported' && ['unsupported', 'not-applicable', 'gui-only', 'partial', 'explicit-diagnostic'].includes(item.rp11));
}

// 所有非 supported 的登记缺口，按 `${id}:rp9|rp11` 展开。
export function documentedGaps() {
  const gaps = [];
  for (const item of VERSION_FEATURES) {
    for (const version of ['rp9', 'rp11']) {
      if (item[version] !== 'supported') gaps.push({ key: `${item.id}:${version}`, version, id: item.id, status: item[version] });
    }
  }
  return gaps;
}

// explicit-diagnostic / partial 必须在源码里留下可搜索的文案，防止矩阵与实现漂移。
// version 缺省为 rp9（历史条目），RP 11 侧需显式声明。
export const DIAGNOSTIC_EVIDENCE = {
  'fade-scale-anchor': { file: 'scripts/ix-actions.mjs', text: 'scale / anchor 是 RP 11 专属能力' },
  'toggle-enabled': { file: 'scripts/ix-actions.mjs', text: 'toggle-enabled has no Axure RP 9 representation' },
  'apply-style': { file: 'scripts/ix-actions.mjs', text: 'apply-style does not exist in Axure RP 9' },
  'rp11-only-events': { file: 'scripts/ix-actions.mjs', text: 'is RP 11-only; Axure RP 9 does not provide it' },
  'rp11-only-fcalls': { file: 'scripts/ix-actions.mjs', text: 'is RP 11-only; Axure RP 9 does not provide it' },
  'repeater-filter-combo-type': { file: 'scripts/ix-actions.mjs', text: 'comboType 在 RP 9 上无对应键' },
  'repeater-delete-row-indices': { file: 'scripts/ix-actions.mjs', text: 'rowIndices 在 RP 9 上改写为 TargetItem.index 规则' },
};
