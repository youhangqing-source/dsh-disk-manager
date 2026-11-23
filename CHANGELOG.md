# Changelog

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
