# 磁盘管家

把磁盘体检与安全清理挂成三个模型可直接调用的工具，配合 `pc-cleanup` 技能使用。

## 功能

| 工具 | 作用 |
|---|---|
| `disk_overview` | 列出所有分区的总容量、已用、可用与可用率（秒级） |
| `disk_scan` | 扫描一个或多个盘的目录占用与超过 1 GB 的大文件；**留空盘符即扫描全部固定盘** |
| `disk_clean` | 按白名单清理缓存，**默认只预览**，`execute: true` 才删除 |

侧边栏「磁盘管家」页提供五个入口：查看空间、扫描全盘、只看 C、只看 D、预览缓存。每个入口开一个新会话并预填提示词。

## 清理白名单

固定六项，不越界：

1. 用户 Temp（7 天以上）与所有 `.part*` 下载残片
2. `%LOCALAPPDATA%\CrashDumps`
3. `%LOCALAPPDATA%\pip\Cache`
4. `%LOCALAPPDATA%\npm-cache`（30 天以上）
5. `%LOCALAPPDATA%\pnpm-cache`（30 天以上）
6. `%LOCALAPPDATA%\uv`（30 天以上）

## 使用方式

直接对模型说：

- “看看各盘还剩多少空间” → `disk_overview`
- “扫一下 D 盘什么最占地方” → `disk_scan`
- “缓存能清多少” → `disk_clean`（预览）
- “清掉吧” → `disk_clean`（execute）

## 限制

- `disk_scan` 需要调用 PowerShell 脚本，只读，不会修改文件；
- `disk_clean` 只删文件、不删目录，遇到被占用的文件会跳过并继续；
- 不清理 `C:\Windows`、`Program Files`、回收站、休眠文件——这些需要管理员权限，请用技能里的 `clean-admin.ps1`；
- 扫描不统计无权限访问的系统目录，结果会略小于真实占用。
