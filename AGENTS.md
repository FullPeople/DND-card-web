# DND Card Web · 执行入口

先读 [AI_CONTEXT/CORE.md](AI_CONTEXT/CORE.md)，再按其中任务表读取对应文件。

- 中文任务执行会话提供的 `chinese-writing-style` 技能；本机入口为 `F:/CodexData/admin/.codex/skills/chinese-writing-style/SKILL.md`。
- 不顺读全部 `docs/`、长交接或流水账，不扫描玩家资料补上下文。
- 线上版本、当前源码、本地候选分开核实，简况见 [CURRENT](AI_CONTEXT/CURRENT.md)。
- 局部变化只处理目标和真实依赖；禁止无依据的全局扫描、重算、清缓存或销毁重建。
- 用户当次指示优先；实现、推送和上线按本次授权分别执行，不把历史任务范围当成当前授权。

旧证据保留原路径；历史通过、待办及发布结论不能覆盖当前事实。
