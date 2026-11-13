# Changelog

## 1.3.2 — 2026-11-14

- Windows 原生宿主：新增 `scripts/axure-host.ps1`，自动完成打开自有副本 → 保存 → 关闭 → 重开 → F5 预览，并按端口与 `start.html` 内容确认预览归属；RP 9 与 RP 11 均实测往返与预览。
- 自动预览在 Windows 桌面会话下可运行，`version-capabilities` 中「自动 Axure 预览」正式登记为两版 `supported`，删除 RP 11 缺口与诊断证据。
- MCP `gui_roundtrip` 任务支持 Windows（PowerShell 宿主），与 macOS 共用同一套阶段标记、队列和失败清理；`host.platform` 明确记录宿主平台。
- 修复宿主「保存」误报：`saved` 不再无条件为 `true`，只有文件确实写入（mtime 变化）才为真；Windows 上 Axure 可能对未修改文档跳过写盘，此时如实返回 `saved:false` 并单独记录 `saveCommandIssued`，任务验收以保存命令已执行为准。
- 新增 `test/axure-preview-windows-check.mjs`（`npm run test:preview-windows`）：两版各跑一次真实宿主往返与预览，缺 Windows 桌面会话或本机 Axure 时 SKIP。

## 1.3.1 — 2026-11-14

- 修复轻量分享包缺少 `scripts/trim-to-single-page.mjs`：`create-blank-project.mjs` 引用它，缺文件会让 CLI 与 MCP 一启动就 `ERR_MODULE_NOT_FOUND`（表现为「无法取得工具列表」）。
- 发布集与分享包新增静态 import 闭包校验：`packRelease` / `packShare` 在打包前逐个核对相对导入是否都在包内，回归新增第 20 项 `share package keeps every referenced module`。
- 修复 `gen-capabilities.mjs` 从未导出的 `runRegression` 导入问题：改为调用 `test/historical-regression.mjs --json` 的公开出口，文档生成不再静态依赖 `test/`。
- 示例 `build-native-demo.mjs` 改用 `scripts/version.mjs` 的 `libraryFile`，分享包不再通过 `test/native-inputs.mjs` 取本机库路径。
- README（中/英）补充说明：MCP 工具列表依赖可选依赖 `@modelcontextprotocol/sdk`，缺少时按提示执行 `npm ci --ignore-scripts`；CLI 不受影响。

## 1.3.0 — 2026-11-13

- 图片离线生成支持 RP 11：`generate_from_image` 的 `version: 11` 不再返回 `E_RP11_GUI_PASTE_REQUIRED`，改为使用本机 RP 11 空白模板走同一套原生场景写入与页面装配，输出可编辑二进制 `.rp`；`guiPaste: true` 仍保留 GUI 粘贴路径。
- OCR 跨平台降级：非 macOS 环境没有 Apple Vision / Swift 时自动跳过文字识别，仅做几何分层，不再因缺少 `swift` 中止整条图片转原型流程。
- RP 9 中继器动作补齐三个 RP 11 键的语义：`removeAll` 拆为前置 `remove-sort(remove-all)` 动作；`rowIndices` 改写为 `TargetItem.index` 规则（删除与更新都覆盖）；`comboType` 在单条件动作下无差异，记录具名适配后省略键。
- 能力矩阵：`repeater-sort-remove-all` 升为两版 `supported`，`repeater-filter-combo-type` / `repeater-delete-row-indices` 的 RP 9 侧升为 `partial`，`offline-image-generate` 的 RP 11 侧升为 `supported`；同步更新缺口台账与诊断证据。
- 新增 `test/image-generate-versions-check.mjs`（`npm run test:image-versions`）：同一张截图分别生成 RP 9 / RP 11，校验文件头、元件数量一致与三零结构。
- 新增 `test/repeater-action-parity-check.mjs`（`npm run test:repeater-actions`）：分别构建 RP 9 / RP 11 中继器并写入三种动作，逐字段核对两版实际落盘的键与拆分动作。
- 本机验证：图片生成两版均 29 个元件、`problems=0`、`danglingRefs=0`；中继器动作测试两版通过。

## 1.2.2 — 2026-11-13

- 原生表单状态样式支持 RP 11：两版 `Axure:Style` 结构一致，`applyNativeWidgetStyles` 不再在 RP 11 上跳过整段状态样式，按目标版本读取本机 `DefaultStyle` 后写入 Hover / Selected / Disabled / Focused 等状态。
- 能力矩阵将 `native-form-state-styles` 的 RP 11 状态提升为 `supported`，删除对应缺口与诊断证据；文档同步说明两版结构一致。
- 新增 `test/native-form-style-versions-check.mjs`（`npm run test:form-styles-versions`）：同一份 `examples/rp-language/native-forms.rp1` 分别构建 RP 9 / RP 11，校验 56 个原生元件、19 个状态样式与三零结构，两版数量必须一致；缺少本机 Axure / Pillow 时 SKIP。
- 本机验证：RP 9 与 RP 11 均 56 元件 / 19 状态样式 / `problems=0` / `danglingRefs=0`。

## 1.2.1 — 2026-11-13

- 原生中继器支持 RP 11：按目标文件的文件头版本选择本机 `Default.rplib`（RP 9 / RP 11 的 Repeater 结构等价），克隆、数据模型与行模板装配走同一套代码；RP 11 不再在写入前报错。
- 能力矩阵将 `native-repeater` 的 RP 11 状态提升为 `supported`，从 `DOCUMENTED_GAPS` 与诊断证据中移除对应条目。
- 新增 `test/native-repeater-versions-check.mjs`（`npm run test:repeater-versions`）：同一份 RP/1 模型分别构建 RP 9 与 RP 11，校验文件头版本、3 列 3 行数据与三零结构；缺少本机 Axure / Pillow 时输出 SKIP，不影响公开 CI。
- 文档同步：能力矩阵、缺口台账与 RP/1 生成资源说明改为按目标版本取安装资源；RP/1 JSON Schema 的 `target` 同步为 `9 | 11`。

## 1.2.0 — 2026-11-13

- 版本能力矩阵改为双向对齐（`SYMMETRIC_PARITY`）：任一版本已支持的能力，另一版本不能再是 `unsupported`；新增 `partial` 状态与 `DOCUMENTED_GAPS` 缺口台账，测试同时校验矩阵、台账与源码中的诊断文案。
- Studio 局部 RP/1 创作支持 RP 11：片段按当前文档 `target` 包装，`target` 与文档不一致时明确报错；RP 9 / RP 11 共用同一套校验与事务。
- 自动 Axure 预览接受 RP 11 目标，仍要求 macOS，并继续用独立预览端口做归属校验。
- 修复发布包缺口：跟踪 `scripts/trim-to-single-page.mjs`（空白工程裁剪的实际实现），移除空的 `scripts/build-rp1.mjs`；`package.json` 发布清单同步。
- 修复 Windows 路径守卫：`AXURE_WRITE_ROOT` / `AXURE_PROTECTED_PATHS` 改用 `path.delimiter` 分隔（盘符不再被误当分隔符），物理消解支持盘符与正斜杠；发布包与链接检查在 Windows 上恢复通过。
- Studio 实例登记文件改用系统临时目录（`os.tmpdir()`），不再依赖 `/tmp`；Chrome / Chromium 探测补充 Windows 安装路径，设计质量测试可在 Windows 走真实截图口径。
- 基线指纹与 SVG 比对按统一换行（LF）计算，`core.autocrlf` 不同的检出不再因 CRLF / LF 误报；`release-manifest.json` 的路径统一使用 `/`。
- 归档整理文档：8 份带日期的历史记录移入 `docs/history/` 并建立索引；`HANDOFF.md` 与 `DELIVERY.md` 合并为 `docs/history/handoff.md`，两份 10 月试用报告合并为 `docs/history/trial-reports-2026-10.md`；同步修正引用链接、`package.json` 发布清单与 `release-manifest.json`。当前技术文档不变。

## 1.1.2 — 2026-11-13

- 项目统一更名为 `return_rp`：包名、命令名、文档与素材引用全部替换；原作者 / 维护者署名为 karlmoriaty，问题反馈邮箱 3070687583@qq.com。
- 新增 RP 9 / RP 11 能力矩阵与对齐门禁（RP 9 必须覆盖 RP 11）：`scripts/version-capabilities.mjs`、`test/version-parity-check.mjs`，并接入 `npm test`；RP 9 的严格三零校验不再受 RP 11 `(节点#N)` 占位页豁免影响。
- 标准化 MIT 许可证文本；补充贡献流程（fork / 分支 / PR / 测试要求）与第三方素材许可说明；移除失效的宣传片下载链接。

- 修复原生 tab-bar 激活/未激活项的文字垂直对齐，离线预览读取真实对齐属性并增加结构门禁。
- GUI 首次文档未就绪时有界重试；失败仅清理未打开且未变更的任务副本，避免重试被遗留输出阻塞。
- 原生多页写入按事务复用解析与上下文、按脏记录批量提交；异步生成和改稿返回分阶段进度，保留原结构/事件校验。
- 修复 Studio phone-shell 导入堆叠、modern-dark 预设缺失及改色后背景/边框不刷新的问题。
- 改善 Studio 点选、双击死区、提示折叠、净空适配和容器内框选；新增 Option/Alt 测距、缩放档位、100%视图与邻页按视口装载。

- 固定 MCP SDK 的间接 HTTP 依赖到兼容 Node18 的版本，避免 npm 静默省略可选 SDK；区分字体文件携带与平台度量回退。

- 修复 Linux 异步浏览器任务的长临时路径 socket 启动失败；工程包测试使用随仓库提供的字体，原生宿主验证单独报告。

- 新增 Studio 自由画布：RP/1 与命令双路线创作、参考设计与局部查询改稿、事务撤销重做、浏览器交互验证、工程包、三方合并、矢量及离线代码导出。
- 增加原生旋转、原生表单与状态样式；原生回填按 GUID 追踪元件身份，保护宏参数、组件实例与数据绑定。
- 修复条件导出：保留事件级 cases、转换分支动作，RP/1 接受带类型检查的 `===` / `!==`，保持字符串字面量原样。
- 补齐公开安装包及浏览器 CI；保留真实模型失败与未完成记录，不再将脚本式 48/48 或旧评分作为真实 AI 成功率。

- 修复 `image.radius/opacity` 在原生与离线预览中被忽略；现代机壳增加局部透明角部遮罩，覆盖前景内容超出内屏圆角的像素。
- 单 label 的双向居中容器继承文字水平居中，保留显式对齐；tab-bar 新增 `activeVariant/activeIndicator/justify/itemFlex`，接通已有激活/非激活颜色与填充设置。
- 状态拼图显示面板视口与内容高度；新增视觉创作指南、导航范例与定向回归，复验试用反馈。
- 重做中文 README，增加英文版、原创工作台封面与栖羽案例，保留旧中文文档入口。

## 0.2.1 — 2026-10-25

- 在中英文 README 加入以「知序」考研复习 App 为案例的 40 秒宣传片。
- 发布复验补齐生成入口在源码校验阶段失败时的 `nextAction`；工具发现测试按注册表与活动清单核对，避免新增工具后仍写死旧数量。

- 处理 GitHub #1/#2：新增 `list-custom-styles`、`rename-custom-style`、`rebind-widgets` 及对应 MCP 具名参数。复用已有原生全局样式，级联更新各记录的 MatchInfo 和 StyleCache，按样式与库身份隔离同名外部样式；绑定同步基样式 GUID、保留几何与交互，并可显式清除局部格式覆盖。不提供凭空生成全局样式定义，未证实内部签名推测。新增 RP/RPLIB 合成回归。

- 第三轮分页复测：read_interactions 增加统一 `items` 列表与 `returned`，消除首页交互分散在 pages/contained 引起的空集误判；明确 offset 是跳过的拥有者数量。保留原分类视图，新增页面事件 + 4 个顶层按钮 + 6 个嵌套按钮的完整边界回归。

- 第三轮工作流修复：restore-tokens 只用字符串身份匹配列表，修复运行期 data-add 行表达式导致 revise 崩溃；母版 slot 注入对应占位容器，保留页面内容与 adaptive，修正手机宽度、机壳偏移和原生分组层级。adaptive 的键、视图、类型、尺寸和位置在 check 阶段诊断。stdio revise 支持 async/dryRun jobs；对象或 JSON 文本 target/source/spec 入口一致；read_interactions 增加拥有者分页和 widget 过滤；成功 revise 将可用预览和报告发布到 .rp.assets 后清场；RP/1 原生生成移除模板 OnLoadVariable，保留旧规格的实际使用。

- 复测收尾：将 after 兄弟引用校验扩展至非 stack 容器（保留有效非 stack 约束的布局提示），按现有渲染令牌设置字号上限 72（含简写与 spans），拒绝负 letterSpacing；残缺表达式统一报告 Unexpected end of expression，不再显示 Python None。

- 修复 10 月 24 日外部问题报告：MCP/CLI 的 autoHeal 统一默认 false，显式自愈按完整门禁对照并回退新增错误，报告逐项属性变更；速查表的设备/颜色/数值令牌改为读取编译器定义。补齐 E_DEPTH、statecharts、显式 selector、stack、palette、重复 page ID、tabBar 目标、字号、控制字符、普通元件 load 与表单宏诊断校验；diagnose 接受对象和序列化对象文本，jobs_cancel 返回明确结果，check 的 JSON 统一 stdout。文本 + 和合法字符串事件简写保留并说明其降低规则。

- **面板状态 `children` 简写全链路前置归一化与 `E_STATE` / `E_OBJECT` 诊断兜底**：修复 `dynamic-panel` / `panel` 嵌套在 `phone-shell` 等宏内且状态使用 `children` 简写（如 `{"id": "idle", "layout": "column", "gap": 14, "children": [...]}`）时，`mark_macro_sources` 在 `desugar_node` 前访问 `state["root"]` 触发裸 `KeyError: 'root'` 的缺陷；修复 `children` 数组混入非 `dict` 元素（如字符串）时 `mark_macro_sources.mark()` 触发 `AttributeError` 裸堆栈或指针回退到父状态的缺陷，统一返回带精确索引 pointer（如 `/pages/0/root/children/0/states/1/children/1`）的 `E_OBJECT` 诊断。同时修复 `.rp1` DSL `:state` 单子节点带 `gap/layout/padding/align` 属性下沉、`:state s1:` 尾冒号剥离、`spec_to_dsl` 对 `children` 状态简写的往返序列化，并对缺失 `root`/`children` 的空状态返回结构化 `E_STATE` 诊断。`runtime_info` 新增 `compilerHashes` 显式列出 `scripts/*.py` 与 `scripts/*.mjs` 各自内存/磁盘哈希，消除 UTC 启动时间与本地文件 mtime 的比对歧义。
- **应用层「零算高」`[fillxhug]` 创作升级与高频移动宏**：`measure_node` 原生支持 `dynamic-panel`、`repeater`、`label`、`card`、`box` 的 `h="hug"` 自动测高；新增 `stat-row`、`list-item`（支持 `tagTone`/`rightTone` 含 `error`/`neutral`）、`card` 内联内容属性（`tag`/`title`/`subtitle`/`body`/`rightBadge`/`actionText`/`goto`）、`panel tabs=[...]` 自动生成分段切换栏、顶层 `tabBar` / `tab-bar:` 一处声明自动注入各页 `phone-shell` 并自动吸底。
- **异步任务、自动自愈与拼图联审**：`generate_prototype` / `revise_prototype` 支持 `async: true` 后台任务句柄（`jobs_list`/`jobs_get`/`jobs_cancel`），`autoHeal` 默认 false、显式 true 时执行安全自愈，并直接生成 `pages-sheet.png`（`contactSheet`）与过滤 `_fill` 进度条辅助态后的纯净 `states-sheet.png`（`statesSheet`）。
- **零跳读 `SKILL.md` 自包含重构**：将 RP/1 `.rp1` 速查表、宏属性与完整多页模板内联至 `SKILL.md`，无需翻阅 `references/` 或 `scripts/` 源码即可一次写成。

### 创作与原生交互改进（2026-10-23）

- progress-bar 运行期填充改为**条件切态**实现：变量绑定时填充是 11 档动态面板（0/10/…/100），变量变化后按档位追加 `if` / `else-if` 链切换状态。此前用原生 `Set Size` 动作，Axure RP9 预览实测**静默不执行**（文字变、几何不变）；改为切态后在真实预览里点击 `done=0/3/10` 实测宽度 0/96/320，与算式一致。
- progress-bar: `value` / `percent` 接受 `$var` 简写（修复 `parse_inline_expr` 关键字参数导致的 TypeError）；表达式初值按变量默认值求值；变量变化时追加原生 `set-size` 动作同步填充宽度（`set-size` 首次成为 RP/1 一等动作，width/height 支持运行期表达式）。
- 布局：节点 `w`/`h` 为 0 或负数改为编译期 `E_SIZE` 诊断（此前会在渲染层抛 PIL `ValueError` 全栈）；渲染层同时加了兜底提示。
- 修正上一轮的误判：`gradient`/`shadow`/`aurora`/`noise` 一直是**原生写入**的（光效层渲染成嵌入位图 + ImageBox），并非"预览专属"；删掉误导告警，仅对 `backdropBlur`（采样静态背景）提示失真风险。
- 手机壳：`phone-shell` 内声明的 `device` 自动提升到页面级（此前宏内有 device 也不出壳）；灵动岛 122×34、补相机控制键、侧键内嵌机身、屏底色默认改暖白。
- 新增 `proto.py tokens`：打印字号/字重/圆角/间距令牌表与文字墨迹规则，供设计期查询。
- 新增 `proto.py measure`：输出每个文字元件的墨迹盒与「安全下一条 y」，排版定位不必再靠试错。
- 设计令牌（数值）：顶层 `tokens` 支持 `$font.h1` / `$radius.card` / `$space.m` 引用，编译期解析为数值；非数值令牌（颜色等）行为不变。
- `icon` 节点仍无字形集：文档标注实际渲染为空占位，建议用 label 或 box 组合替代。
- 新增 `z`：`stack` 子元件按 z 稳定排序并回写绘制顺序（此前只能用声明顺序硬凑层级）。
- 新增 `stack` 布局约束：`after`（紧跟某个兄弟）/ `afterGap` / `alignX: left|center|right`，编译期解析成坐标并回写；`after` 支持逻辑 id、原生名后缀与名字段匹配，`badge`/`button` 展开时保留逻辑 id 与约束键。
- 新增 `pin` / `pinGap`：贴 `top|bottom|left|right` 边；约束在展开阶段统一保留（任意节点类型，含 badge/button 的 id 与约束键），非 stack 父容器使用约束会给出 `constraint_outside_stack` 告警。
- 矢量渐变取证（未打通）：从 RP11 程序集字符串表解出填充键名（`fill-colors`/`fill-offsets`/`fill-angle`/`fill-center-point`/`fill-axis1|2`）与类型值（`linearGradient`/`radialGradient`），实测两种候选编码被 Axure 原样保存但**不渲染**；生产仍用 2× 位图，实验开关 `AXURE_VECTOR_GRADIENT=1`。全过程见 `references/gradient-fill-research.md`。
- 新增 `tools/probe-gradient-fill.mjs`：给定一个"手工画过渐变"的 `.rp`，打印 RP9 实际的渐变填充结构（键名/类型值/停靠点）。矢量渐变落地前的取真值工具；本机 300 个 `.rp` 扫描结果为零，故当前仍用位图实现。
- 澄清：光效层（gradient/shadow/aurora/noise）输出的是 **2× 位图**（280×120 元件 → 560×240 图），Retina 下不发虚，无需再加超采样。
- 新增 `test/preview-progress-probe.mjs`：在 Axure 真实预览里点击并测量 progress-bar 填充宽度的可复跑探针（需 playwright-core）。
- `check` 失败时返回 `diagnostics`（E_LAYOUT + pageName），并补 2 个回归用例；布局令牌 `after/afterGap/alignX` 加入节点白名单，不再触发未知属性告警。
- 新增遮挡审计 `text_occluded`（告警）：文字墨迹被后声明的不透明图元覆盖超过 50% 时提示——此前「审计全绿但字被柱子埋掉」无任何信号。
- 未知颜色令牌改为硬错误 `E_COLOR` 并给近似建议（此前 `$Brand` 这类拼错会静默变正文色）。
- `label` 支持 `lineHeight` 并参与多行墨迹测量。
- MCP `generate_prototype` 响应新增 `statePreviews`：每个面板状态的预览图路径直接回传（此前只写进 `.build/states/`，评审多态页得自己翻目录）。
- 新增 `proto.py doctor`：打印字体解析结果、主题令牌、预览专属样式与命令清单，用于排查字重回退这类静默降级。
- 面板状态预览图改为去掉原生 hash 的稳定文件名。

## 0.2.0 — 2026-10-21

- Ship screenshot reconstruction, OCR, chart geometry, layering, corrections and visual differences with all Python/Swift support sources.
- Add RP/1 JSON/text language, native generation, runtime data, rules, bounded masters/adaptive views and merge tools.
- Include RP9/RP11 adaptation, native acceptance helpers and synthetic tests/benchmarks.
- Preserve public CLI/MCP global-variable support and configurable protected paths.
- Replace extracted mobile assets with original geometric icons/frames and add an original screenshot example.
- Expand packaging to include runtime sources, tools, synthetic fixtures and examples.
- Fix rich-text CLI initialization order for embedded hyperlink templates, and align RP9 GUI helper defaults with the screenshot draft output.
- State verification levels and limitations instead of historical full-score claims.

## 0.1.1

Previous public native-file toolkit release. Apply this delivery as an update in the existing repository to preserve its history.
