# Backend

- Character Snapshot 是唯一 authoritative state；前端缓存和平台投影不是权威数据。
- 所有已创建角色的内容修改必须经过 character.Service 的 Operation pipeline；operationId 全局唯一、在配置回执窗口内幂等，每个成功 batch 增加 revision。回执清理必须同时满足时间、至少10倍log的revision窗口及对应log已删除；超窗原请求不得重新应用，按 docs/protocol/SYNC.md 恢复。
- 事务内禁止网络与广播；提交后才通知 Hub。Adapter 只产生 Canonical Operation，不能写数据库。
- SQL migrations 必须版本化，禁止用 AutoMigrate 代替生产迁移。
- 协议变化同时更新根 openapi.yaml、backend/schemas、docs/api、docs/protocol、docs/frontend；不能为适配前端随意破坏兼容。
- 保留已有 Character v1 数组及稳定 ID；协议使用 /selections/entities/{id} 虚拟路径，禁止数组下标编辑。
- 在 backend 运行 go test ./...、go vet ./...；涉及并发时运行 go test -race ./...。依赖支持 CGO_ENABLED=0 Windows 构建。
- 不在源码、日志或测试夹具内加入玩家数据、凭证或上游正文。
