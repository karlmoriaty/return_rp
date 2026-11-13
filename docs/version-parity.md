# RP 9 / RP 11 能力对齐

**口径（1.2.0 起）：双向对齐。任一版本能做的事，另一版本不能是 `unsupported`。**

- 一项能力在一侧是 `supported`，另一侧至少要是 `supported` / `partial` / `explicit-diagnostic` / `gui-only` / `not-applicable`，并且登记在 `DOCUMENTED_GAPS`。
- `partial` 表示结构已写入、具名子能力被跳过并在运行时告警；`explicit-diagnostic` 表示原生没有对应结构，写入前明确报错，绝不静默丢弃参数。
- `gui-only` 表示需要 Axure GUI 参与；`not-applicable` 表示该版本没有这个原生模型。
- 缺口台账与源码里的诊断文案都由测试校验，能力升级时同步更新矩阵。
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
| 原生表单状态样式 | supported | supported | 两版 `Axure:Style` 结构一致，按目标版本读本机 `DefaultStyle` |
| 原生中继器 | supported | supported | RP 9 / RP 11 各取本机 `Default.rplib` 中结构等价的 Repeater |
| 自适应视图 | supported | supported | RP 9 不写 `Cursor` 字段 |
| 核心交互与动作 | supported | supported | 同名不同型的字段按版本转换 |
| 中继器数据操作 | supported | supported | 排序、过滤、增删改 |
| 显示/切换的缩放与锚点 | explicit-diagnostic | supported | RP 9 `FadeWidgetInfo` 无对应键 |
| 切换启用状态 | explicit-diagnostic | supported | RP 9 `enable` 是 bool，无 toggle |
| 应用样式动作 | explicit-diagnostic | supported | RP 9 无 `InteractionApplyStyle` 类型 |
| RP 11 专属事件 | explicit-diagnostic | supported | `OnErrorSet` / `OnErrorRemoved` / `OnBeforeItemLoad` |
| RP 11 专属表达式函数 | explicit-diagnostic | supported | `ToLowerCase` / `GetErrorState` / `SetErrorState` |
| 清除其他排序 | supported | supported | RP 9 拆为前置 `remove-sort(remove-all)` 动作 |
| 过滤组合类型 | partial | supported | RP 9 无 `FilterComboType`；单条件动作按顺序过滤（AND） |
| 按行号删除中继器行 | partial | supported | RP 9 改写为 `TargetItem.index` 规则，运行时待预览实测 |
| Studio 局部 RP/1 创作 | supported | supported | 按文档 `target` 包装片段，9 / 11 同一套校验 |
| 自动 Axure 预览 | supported | supported | macOS 走 Swift 宿主；Windows 走 PowerShell 宿主，RP 9 / RP 11 均已实测往返与预览（未修改的文档可能被 Axure 跳过写盘，宿主如实返回 `saved`） |
| 图片离线生成原生工程 | supported | supported | 两版都离线写二进制；RP 11 使用本机空白模板 |
| CLI / MCP 入口 | supported | supported | 两版共用同一批工具 |
| 版本专属键 lint | supported | supported | 按文件头版本扫描 |

机器可读矩阵在 [`scripts/version-capabilities.mjs`](../scripts/version-capabilities.mjs)。新增版本分支时必须同步登记，否则 `npm test` 失败。

## 已登记缺口

| 缺口 | 状态 | 原因 |
| :--- | :--- | :--- |
| 面板注册链修复 @ RP 11 | not-applicable | RP 11 没有 `DynamicPanelInfo` / `PanelDiagramInfo` |
| 缩放锚点 / 切换启用 / 应用样式 / RP 11 事件与函数 @ RP 9 | explicit-diagnostic | RP 9 原生结构或运行时没有对应模型 |
| 过滤组合类型 @ RP 9 | partial | 无 `FilterComboType` 键；单条件顺序过滤等价于 AND |
| 按行号删除 @ RP 9 | partial | 改写为 `TargetItem.index` 规则，运行时未在 RP 9 预览实测 |

## 验证

```sh
node test/version-parity-check.mjs
node test/native-repeater-versions-check.mjs   # 需本机 Axure 安装与 Python Pillow，缺依赖时 SKIP
node test/native-form-style-versions-check.mjs # 同上
node test/repeater-action-parity-check.mjs     # removeAll / comboType / rowIndices 两版对齐
node test/image-generate-versions-check.mjs   # 图片离线生成本地 RP 9 / RP 11 一致
node test/axure-preview-windows-check.mjs      # 需 Windows 桌面会话与本机 Axure，缺依赖时 SKIP
```

测试会检查：

1. 矩阵项与状态合法、ID 唯一；
2. 两个方向都不存在「一侧 supported、另一侧 unsupported」；
3. 每个非 `supported` 项都登记在 `DOCUMENTED_GAPS`，台账没有孤儿项；
4. `explicit-diagnostic` / `partial` 都在源码里留有可搜索的文案；
5. RP 9 侧既有能力（表单状态样式、中继器、面板注册链、Studio 局部创作、自动预览、图片离线生成）保持 supported 且 RP 11 侧有同级或更高登记；
6. `DEFAULT_VERSION` 保持 11，且两版都仍在支持列表里。

RP 9 的严格三零校验不会被 RP 11 的文件夹页面豁免影响：`proto.mjs` 只在 `targetVersion === 11` 时忽略 `(节点#N)` 占位页。

