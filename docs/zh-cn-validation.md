# 简体中文版验证记录

核对日期：2026-11-19。验证环境：Windows，Node.js 24、pnpm 12.15.0、Go 1.27.4。

## 已完成

- 网页单元测试：98 项通过，0 项失败。
- 中文网页生产构建、SDK 构建、Windows Go 编译。
- 汉化期间的网页和 worker 类型检查、前端 lint。
- 桌面和手机尺寸界面验收，包括聊天、搜索、话题、设置、机器人管理；HTTP 与 WebSocket 连接验证。

## 完整测试的实际结果

发布前重新执行 `pnpm test`。网页 98 项测试、网页构建和 SDK 构建通过；Go 测试中的以下三个项目在 Windows 下失败，因此不能把完整套件描述为全部通过：

| 测试 | Windows 下的实际结果 |
| --- | --- |
| `TestWriteClientConfigFileCreatesPrivateFile` | 文件模式返回 `0666`，测试期待 Unix 模式 `0600`。 |
| `TestWriteClientConfigFilePreservesWritableMode` | 文件模式返回 `0666`，测试期待 Unix 模式 `0640`。 |
| `TestOpenUploadStorageValidation` | 测试把 Windows 临时路径直接拼成 `file://C:\...`，URL 解析失败。 |

这部分沿用上游测试和实现，本汉化发布未调整后端文件权限或上传存储逻辑。其他具有测试的 Go 包在此次运行中通过。Windows 可编译、运行和使用中文界面的验证，与完整跨平台测试全部通过是不同的结论。

## 发布内容

源码发布为独立快照，保留 MIT 许可和上游引用。未包含本机数据库、聊天记录、登录凭据或专用机器人桥接。上游专用自动部署和签名发版工作流未启用；Cloudflare 配置中的账号和域名已替换为需要自行填写的示例。
