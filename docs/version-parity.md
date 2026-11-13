# RP 9 / RP 11 能力对齐

**口径：RP 9 是完整基线。RP 9 能做的能力必须多于或等于 RP 11。**

- 只要某项能力在 RP 11 标记为 `supported`，RP 9 就必须是 `supported` 或 `explicit-diagnostic`。
- `explicit-diagnostic` 表示 Axure RP 9 原生没有对应结构，本工具在写入前明确报错，绝不静默丢弃参数。
- RP 11 可以少能力；RP 9 独有能力不得因 RP 11 改动被删除。
- 默认目标版本仍是 **RP 11**；需要 RP 9 时显式写 `target=9` 或设置 `AXURE_TARGET_VERSION=9`。

## 能力矩阵

| 能力 | RP 9 | RP 11 | 说明 |
| :--- | :--- | :--- | :--- |
| RP/1 原生编译 | supported | supported | 两版都走 `target` 分支 |
| 场景写入原生页面 | supported | supported | `native-scene.mjs` 按文件头版本选择字段集 |
| 空白工程模板检测与裁剪 | supported | supported | 脏模板自动裁成单页 |
| 克隆原生动态面板 | supported | supported | 模板分别取 RP9 Tour / Quick Win |
| 面板状态内容装配 | supported | supported | 含嵌套面板与中继器 |
| 面板注册链修复 | supported | not-applicable | RP 11 没有该注册模型 |
| 原生表单控件克隆 | supported | supported | 控件、文字与几何 |
| 原生表单状态样式 | supported | unsupported | RP 11 的 `Axure:Style` 结构不同，暂跳过并告警 |
| 原生中继器 | supported | unsupported | 当前只克隆 RP 9 `Default.rplib` 的 Repeater |
| 自适应视图 | supported | supported | RP 9 不写 `Cursor` 字段 |
| 核心交互与动作 | supported | supported | 同名不同型的字段按版本转换 |
| 中继器数据操作 | supported | supported | 排序、过滤、增删改 |
| 显示/切换的缩放与锚点 | explicit-diagnostic | supported | RP 9 `FadeWidgetInfo` 无对应键 |
| 切换启用状态 | explicit-diagnostic | supported | RP 9 `enable` 是 bool，无 toggle |
| 应用样式动作 | explicit-diagnostic | supported | RP 9 无 `InteractionApplyStyle` 类型 |
| RP 11 专属事件 | explicit-diagnostic | supported | `OnErrorSet` / `OnErrorRemoved` / `OnBeforeItemLoad` |
| RP 11 专属表达式函数 | explicit-diagnostic | supported | `ToLowerCase` / `GetErrorState` / `SetErrorState` |
| 清除其他排序 | explicit-diagnostic | supported | `remove-all-sorts` 为 RP 11 键 |
| 过滤组合类型 | explicit-diagnostic | supported | `FilterComboType` 为 RP 11 键 |
| 按行号删除中继器行 | explicit-diagnostic | supported | `RowIndices*` 为 RP 11 键 |
| Studio 局部 RP/1 创作 | supported | unsupported | 局部入口当前只接受 `target=9` |
| 自动 Axure 预览 | supported | unsupported | 当前仅 macOS + RP 9 工程 |
| 图片离线生成原生工程 | supported | gui-only | RP 11 需 `axvg` GUI 粘贴，不离线写二进制 |
| CLI / MCP 入口 | supported | supported | 两版共用同一批工具 |
| 版本专属键 lint | supported | supported | 按文件头版本扫描 |

机器可读矩阵在 [`scripts/version-capabilities.mjs`](../scripts/version-capabilities.mjs)。新增版本分支时必须同步登记，否则 `npm test` 失败。

## 验证

```sh
node test/version-parity-check.mjs
```

测试会检查：

1. 矩阵项与状态合法、ID 唯一；
2. 不存在「RP 11 支持、RP 9 既没实现也没明确诊断」的能力；
3. 每条 `explicit-diagnostic` 都在源码里留有可搜索的拒绝文案；
4. RP 9 独有能力（表单状态样式、中继器、面板注册链、Studio 局部创作、自动预览、图片离线生成）仍然存在；
5. `DEFAULT_VERSION` 保持 11，且两版都仍在支持列表里。

RP 9 的严格三零校验不会被 RP 11 的文件夹页面豁免影响：`proto.mjs` 只在 `targetVersion === 11` 时忽略 `(节点#N)` 占位页。
