# Changelog

## 0.4.2

- `workspace_tidy` 新增 `linkOld`：改名后若该工作区有历史会话，在旧路径上建 junction，使会话日志里保存的 cwd 仍然可访问（否则恢复对话会报 `working-directory: directory does not exist`）。
- 不改名时也会提示“该工作区有历史会话，旧路径已不存在”。

## 0.4.1

- 修复：`workspace_tidy` 改名工作区后，会话桶（`~/.dsh/sessions/<路径转义>`）没有跟着改，导致该工作区里的对话无法打开。现在改名时会同步桶目录。
- 文档补充会话桶的命名规则与风险说明。

## 0.4.0

- 新增 `workspace_tidy` 工具：列出工作区路径、体积、会话数与建议命名，可批量改名并同步 `workspace.json`，可选清理空工作区；默认只预览，写入前自动备份。
- 侧边栏新增「规整工作区」入口。

## 0.3.0

- `disk_scan` 支持多盘与全盘扫描（`drives` 可选，留空扫全部固定盘）。
- 侧边栏页面改为归藏风格的编辑式列表，新增「扫描全盘 / 只看 C / 只看 D」入口。

## 0.2.0

- 新增侧边栏「磁盘管家」页面（`sidebar.panellist` + `main` keyed 面板）。
- 页面提供查看空间、扫描、预览缓存三个入口。

## 0.1.0

- 首个版本：`disk_overview`、`disk_scan`、`disk_clean` 三个工具，白名单缓存清理默认 dry-run。
