# 历史记录索引

本目录归档 2026-10-25 至 2026-11-03 的开发过程文档，保留当时的进度记录、试用分数、缺陷台账与证据位置。它们是**带日期的事实记录**，不是当前能力说明：

- 分数、断言数、性能数字只对各自时间点的样本成立，失败与未完成记录一律保留，不做美化。
- 文中出现的本机路径（`/Users/...`、`~/.zcode/...`、`outputs/...`）是当时的证据位置，不随仓库分发。
- 能力边界以 [RP 9 / RP 11 能力对齐](../version-parity.md) 和 [能力表](../../references/capabilities.md) 为准；Studio 的当前用法见 [Studio 与 AI 创作](../studio-ai-authoring.md)。

## 文档

| 文件 | 时间 | 内容 |
| :--- | :--- | :--- |
| [handoff.md](handoff.md) | 2026-10-27 — 2026-11-03 | 交接与交付记录：交付清单、逐日实现与验收进度、原始交接、回退方式 |
| [trial-reports-2026-10.md](trial-reports-2026-10.md) | 2026-10-25 / 10-27 | 2026 年 10 月试用报告：外部试用分数轨迹与判词（原 `design-tools-trial-report.md`）、视觉创作反馈复验（原 `authoring-feedback-20261025.md`） |
| [agent-trial-findings-2026-10-27.md](agent-trial-findings-2026-10-27.md) | 2026-10-27 | 逐轮缺陷台账：问题、根因、修法、回归证据 |
| [studio-candidates-20261027.md](studio-candidates-20261027.md) | 2026-10-27 | 自由构图与多状态预演的调用与边界 |
| [studio-editing-20261027.md](studio-editing-20261027.md) | 2026-10-27 | 关系/批量编辑与画面对照的实现与验收说明 |
| [free-canvas-design-ceiling.md](free-canvas-design-ceiling.md) | 2026-10-27 | 能力边界与五层模型：能做什么、明确不做什么 |

## 维护约定

- 归入本目录的文档不再更新；新结论写入当前文档或在 [CHANGELOG](../../CHANGELOG.md) 中记录。
- 移动或合并归档文档时，同步修正引用链接，并保持正文中的日期与原始结论不变。
