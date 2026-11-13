// Axure RP 9 / RP 11 工具能力矩阵。
//
// 定位：RP 9 是完整基线，RP 11 可以少能力，但不能出现「RP 11 能做、RP 9 连明确
// 诊断都没有」的缺口。测试 tools/version-parity-check.mjs 会强制这条规则。
//
// 状态含义：
//   supported            本工具在该版本有完整写入/读取路径
//   explicit-diagnostic  Axure 该版本没有对应原生结构；写入前明确报错，绝不静默降级
//   gui-only             只能借助 Axure GUI 完成，不做离线二进制写入
//   unsupported          本工具在该版本不提供
//   not-applicable       该版本没有这个原生模型
//
// 新增版本分支时，必须同时在这里登记；只有注释没有矩阵项会被对齐测试判失败。
export const PARITY_RULE = 'RP9_SUPERSET_OF_RP11';

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
  feature('native-form-state-styles', '原生表单状态样式', 'supported', 'unsupported',
    'RP 11 的 Axure:Style 结构不同，当前跳过状态样式但保留控件、文字与几何'),
  feature('native-repeater', '原生中继器', 'supported', 'unsupported',
    '当前只从 RP 9 Default.rplib 克隆 Repeater'),
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
  feature('repeater-sort-remove-all', '清除其他排序', 'explicit-diagnostic', 'supported',
    'remove-all-sorts 是 RP 11 新增键'),
  feature('repeater-filter-combo-type', '过滤组合类型', 'explicit-diagnostic', 'supported',
    'FilterComboType 是 RP 11 新增键'),
  feature('repeater-delete-row-indices', '按行号删除中继器行', 'explicit-diagnostic', 'supported',
    'RowIndicesText / RowIndicesRule 是 RP 11 新增键'),
  feature('studio-rp1-local', 'Studio 局部 RP/1 创作', 'supported', 'unsupported',
    '局部 Studio RP/1 入口当前只接受 target=9'),
  feature('axure-preview', '自动 Axure 预览', 'supported', 'unsupported',
    '当前只支持 macOS + 目标版本 RP 9 的工程'),
  feature('offline-image-generate', '图片离线生成原生工程', 'supported', 'gui-only',
    'RP 11 走 axvg GUI 粘贴，不离线写二进制 .rp'),
  feature('cli-mcp', 'CLI / MCP 入口', 'supported', 'supported'),
  feature('version-lint', '版本专属键 lint', 'supported', 'supported'),
];

export const FEATURE_STATUSES = ['supported', 'explicit-diagnostic', 'gui-only', 'unsupported', 'not-applicable'];

export function featureById(id) {
  return VERSION_FEATURES.find(item => item.id === id) ?? null;
}

// 违反「RP 9 ≥ RP 11」的能力：RP 11 支持，但 RP 9 既没有实现也没有明确诊断。
export function rp9ParityViolations() {
  return VERSION_FEATURES.filter(item =>
    item.rp11 === 'supported' && !['supported', 'explicit-diagnostic'].includes(item.rp9));
}

// RP 9 独有能力（RP 11 不支持或只能走 GUI）：这些能力证明 RP 9 不是 RP 11 的子集。
export function rp9ExclusiveFeatures() {
  return VERSION_FEATURES.filter(item =>
    item.rp9 === 'supported' && ['unsupported', 'not-applicable', 'gui-only'].includes(item.rp11));
}

// 每条 explicit-diagnostic 都必须在源码里留下可搜索的拒绝文案，防止矩阵与实现漂移。
export const DIAGNOSTIC_EVIDENCE = {
  'fade-scale-anchor': { file: 'scripts/ix-actions.mjs', text: 'scale / anchor 是 RP 11 专属能力' },
  'toggle-enabled': { file: 'scripts/ix-actions.mjs', text: 'toggle-enabled has no Axure RP 9 representation' },
  'apply-style': { file: 'scripts/ix-actions.mjs', text: 'apply-style does not exist in Axure RP 9' },
  'rp11-only-events': { file: 'scripts/ix-actions.mjs', text: 'is RP 11-only; Axure RP 9 does not provide it' },
  'rp11-only-fcalls': { file: 'scripts/ix-actions.mjs', text: 'is RP 11-only; Axure RP 9 does not provide it' },
  'repeater-sort-remove-all': { file: 'scripts/ix-actions.mjs', text: 'remove-all-sorts' },
  'repeater-filter-combo-type': { file: 'scripts/ix-actions.mjs', text: 'comboType 是 RP 11 专属键' },
  'repeater-delete-row-indices': { file: 'scripts/ix-actions.mjs', text: 'rowIndices 是 RP 11 专属键' },
};
