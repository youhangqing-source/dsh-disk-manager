# dsh-disk-manager

给 [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh)（dsh）用的磁盘管家插件：四个模型可调用的工具 + 一个侧边栏页面。

## 能做什么

| 工具 | 作用 |
|---|---|
| `disk_overview` | 所有分区的容量、已用、可用率（秒级） |
| `disk_scan` | 扫描一个或多个盘的目录占用与超过 1 GB 的大文件；不传盘符即扫描全部固定盘 |
| `disk_clean` | 按白名单清理缓存，默认只预览，`execute: true` 才删除 |
| `workspace_tidy` | 规整 dsh 工作区：按「项目-/实验-/工具-」统一命名、同步 `workspace.json`、清理空工作区 |

侧边栏「磁盘管家」页提供六个入口：查看空间、扫描全盘、只看 C、只看 D、预览缓存、规整工作区。

## 安装

### 桌面版（本地目录）

1. 把整个 `dsh-disk-manager` 文件夹放到本机固定位置，例如 `D:\dsh-plugins\dsh-disk-manager`（**不要放下载/临时目录**，插件是指向它的链接）。
2. dsh 桌面版 → 左侧「插件」→「添加插件」→ 选择**本地目录** → 指向该文件夹。
3. 安装完成后点「立即启用」，按 `Ctrl+Shift+R` 刷新页面。

> 桌面版的 profile 由 App 管理，不能用 `dsh plugin --profile desktop`。

### 网页版 / CLI

```bash
dsh plugin --profile web add github:youhangqing-source/dsh-disk-manager
dsh plugin --profile web add link:D:/dsh-plugins/dsh-disk-manager
```

## 更新

插件管理器**不会**轮询上游，没有“有新版本”提示。更新方式：

1. 拉取最新代码（`git pull` 或重新下载压缩包）；
2. 插件页里**卸载**，再按安装步骤重装一次；
3. 刷新页面。

版本变更见 [CHANGELOG.md](CHANGELOG.md)。

## 要求

- **Windows**：`disk_scan` 调用 `powershell.exe`，`disk_clean` 使用 `%LOCALAPPDATA%`。macOS / Linux 上只有 `disk_overview` 与 `workspace_tidy` 可用。
- dsh `0.2.x`（在 `0.2.2-rc.5` 上验证）。
- 无需管理员权限。

## 安全边界

- 清理白名单固定六项：用户 Temp（7 天以上）、CrashDumps、pip、npm、pnpm、uv 缓存；
- 不触碰 `C:\Windows`、`Program Files`、回收站、`hiberfil.sys`、注册表；
- 清理与规整默认 dry-run；`workspace.json` 每次写入前备份为 `.bak-<时间戳>`；
- 当前会话所在目录不会被改名。

## 结构

```
index.js           Host 半边：四个工具
client.js          浏览器半边：侧边栏页面
cordis.patch.yml   bundle 补丁
scripts/scan.ps1   只读扫描脚本
locale/            中英文标题与描述
docs/DETAIL.md     插件详情页
icon.svg           插件图标
```

## License

MIT
