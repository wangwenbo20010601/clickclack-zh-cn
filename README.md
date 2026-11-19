# ClickClack 简体中文版

基于 [openclaw/clickclack](https://github.com/openclaw/clickclack) v0.9.5 制作的社区汉化版本，适合在自己的电脑或服务器运行。

ClickClack 是支持频道、话题、私聊、附件和机器人的自托管聊天平台，由 Go 后端、Svelte 网页、CLI 和 TypeScript SDK 组成。本仓库主要修改界面语言，保留上游 MIT 许可，不代表上游官方中文发行版。

## 汉化范围

- 聊天界面、频道导航、搜索、引用回复和话题。
- 个人资料、外观、通知、工作区、成员、机器人及集成管理。
- 登录相关页面、附件与内容查看界面、介绍首页。
- 中文日期、常用提示及错误信息，简体中文字体回退。
- 手机窄屏显示和机器人标签换行细节。

品牌名、用户名、频道技术名称、代码和聊天内容保持原样。少量由后端动态返回的技术错误仍可能为英文。此版本默认中文，未新增中英文切换开关。

## 从源码构建：Windows

需要 Git、Node.js 24+、pnpm 12.15.0、Go 1.27.4。Go 模块最低版本和工具链版本以 `go.mod` 为准。

在 PowerShell 中运行：

```powershell
git clone https://github.com/wangwenbo20010601/clickclack-zh-cn.git
cd clickclack-zh-cn
npm exec --yes --package=pnpm@12.15.0 -- pnpm install --frozen-lockfile
$env:CLICKCLACK_WEB_VERSION = '0.9.5-zh-CN'
npm exec --yes --package=pnpm@12.15.0 -- pnpm build
New-Item -ItemType Directory -Path dist -Force | Out-Null
$env:CGO_ENABLED = '0'
go build -trimpath -ldflags '-s -w -X main.version=0.9.5-zh-CN' -o dist/clickclack.exe ./apps/api/cmd/clickclack
.\dist\clickclack.exe serve --addr 127.0.0.1:8080 --data .\data --dev-bootstrap=true
```

打开 [http://127.0.0.1:8080/app](http://127.0.0.1:8080/app)。空数据目录会通过开发引导创建本机测试用的所有者、工作区和默认频道。数据写入指定的 `data`，不会导入其他人的记录。

`pnpm build` 会构建中文网页、SDK 并把网页资源准备到 Go 嵌入目录；不要跳过它直接编译 Go，否则可能得到缺失或过期的界面。

## macOS / Linux

安装相同工具链，在仓库根目录运行：

```sh
npm exec --yes --package=pnpm@12.15.0 -- pnpm install --frozen-lockfile
CLICKCLACK_WEB_VERSION=0.9.5-zh-CN npm exec --yes --package=pnpm@12.15.0 -- pnpm build
mkdir -p dist
CGO_ENABLED=0 go build -trimpath -ldflags '-s -w -X main.version=0.9.5-zh-CN' -o dist/clickclack ./apps/api/cmd/clickclack
./dist/clickclack serve --addr 127.0.0.1:8080 --data ./data --dev-bootstrap=true
```

上述是源码构建步骤。本次运行验证在 Windows 完成，未逐个平台验证中文安装包。其他选项见 [安装说明](docs/install.md) 和 [开发说明](docs/development.md)。

## 第一次使用

1. 打开本机网页；左侧“频道”下的 `#general` 是一个聊天室，点击即可进入。
2. 点击底部输入框写消息，右侧纸飞机发送；`Shift+Enter` 换行。提及候选展开时，Enter 可能先选中候选。
3. 鼠标移到消息上，“回复”可引用它继续说；“打开话题”会在右侧打开独立讨论栏。
4. 左侧“频道”右边的 `＋` 用于新建频道；最左侧竖栏的 `＋` 用于新建工作区。
5. 左下角个人头像打开账户设置；左上角工作区名称打开工作区设置。

本仓库提供聊天平台和中文界面。创建机器人成员后，还需单独运行机器人程序、连接模型并处理消息；这里不附带任何人的 Codex、OpenClaw、模型密钥或本机专用桥接配置。参见 [机器人文档](docs/features/bots.md)、[SDK](docs/sdk.md) 和 [API](docs/api/overview.md)。

## 已有后端：单独预览中文网页

如果已有 ClickClack 后端运行在 `127.0.0.1:18484`，完成构建后可运行：

```powershell
npm exec --yes --package=pnpm@12.15.0 -- pnpm --filter @clickclack/web exec vite preview --config vite.zh.config.ts
```

打开 [http://127.0.0.1:18486/app](http://127.0.0.1:18486/app)。`apps/web/vite.zh.config.ts` 将 API 和 WebSocket 转发到已有后端，不创建第二套数据库。全新安装可直接使用上面的 Go 单程序方案。

## 手机和远程访问

`127.0.0.1` 只代表访问设备自己，电脑上的这个地址不能直接填到另一台手机使用。手机访问需要另外配置网络和认证；本仓库不会自动创建公网入口。

上面的 `--dev-bootstrap=true` 用于本机开发体验。面向公网部署时，按 [部署说明](docs/deployment.md) 配置真实认证、TLS、存储与备份，并关闭开发引导。

## 验证与升级

汉化过程已验证网页单元测试、类型检查、lint、网页生产构建、Windows Go 编译和桌面/手机尺寸界面。发布前网页 98 项测试通过；完整 Go 套件存在 3 项上游 Windows 路径/权限测试失败，详见 [验证记录](docs/zh-cn-validation.md)。上游通用测试入口：

```sh
npm exec --yes --package=pnpm@12.15.0 -- pnpm test
```

安装上游官方发行版不会自动保留本仓库的中文修改。升级时请合并对应上游版本、重新应用汉化并构建。

仓库中的 Cloudflare 配置已改为部署示例；采用该方式时需填写自己的账号、域名和存储信息。

## 上游与许可

- 原项目：[openclaw/clickclack](https://github.com/openclaw/clickclack)
- 保留的上游首页：[README.upstream.md](README.upstream.md)
- 技术文档：[docs/](docs/README.md)
- 许可：[MIT](LICENSE)，保留原作者版权声明。

上游首页和技术文档中部分下载链接指向原项目，它们不是本中文分支的发行物。
