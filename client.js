window.__ModuleLoader__.load({
  id: 'dsh-disk-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PANEL_ID = 'disk-manager'

    // Design language borrowed from guizang-design (Swiss / editorial):
    // mono kicker, big tight display title, hairline rules, generous rhythm.
    const CSS = `
.dm-page{
  --dm-line: var(--dsw-alias-border-subtle, rgba(128,128,128,.28));
  --dm-muted: var(--dsw-alias-text-secondary, rgba(128,128,128,.95));
  --dm-accent: #002FA7;
  --dm-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --dm-sans: 'Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  box-sizing: border-box;
  max-width: 880px;
  padding: 40px 44px 56px;
  font-family: var(--dm-sans);
  color: inherit;
}
.dm-page *{ box-sizing: border-box; }
.dm-kicker{
  font-family: var(--dm-mono);
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--dm-muted);
}
.dm-title{
  margin: 10px 0 0;
  font-size: 36px;
  line-height: 1.02;
  letter-spacing: -.022em;
  font-weight: 650;
}
.dm-sub{
  margin: 14px 0 0;
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--dm-muted);
  max-width: 60ch;
}
.dm-list{
  margin-top: 40px;
  border-top: 1px solid var(--dm-line);
}
.dm-row{
  display: grid;
  grid-template-columns: minmax(0,1fr) auto;
  align-items: center;
  gap: 28px;
  padding: 20px 0;
  border-bottom: 1px solid var(--dm-line);
}
.dm-row h3{
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -.005em;
}
.dm-row p{
  margin: 5px 0 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--dm-muted);
}
.dm-meta{
  display: inline-block;
  margin-top: 8px;
  font-family: var(--dm-mono);
  font-size: 10.5px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--dm-muted);
}
.dm-actions{ display: flex; gap: 8px; }
.dm-btn{
  appearance: none;
  border: 1px solid var(--dm-line);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 7px 15px;
  font-family: var(--dm-sans);
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s ease, border-color .15s ease, transform .1s ease;
}
.dm-btn:hover{ border-color: var(--dm-accent); }
.dm-btn:active{ transform: translateY(1px); }
.dm-btn--primary{
  background: var(--dm-accent);
  border-color: var(--dm-accent);
  color: #fff;
}
.dm-btn--primary:hover{ background: #001d6b; border-color: #001d6b; }
.dm-foot{
  margin-top: 36px;
  display: grid;
  gap: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--dm-muted);
}
.dm-tag{
  display: inline-block;
  min-width: 62px;
  margin-right: 10px;
  font-family: var(--dm-mono);
  font-size: 10.5px;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--dm-accent);
}
@media (max-width: 640px){
  .dm-page{ padding: 28px 22px 40px; }
  .dm-title{ font-size: 28px; }
  .dm-row{ grid-template-columns: 1fr; gap: 12px; }
  .dm-actions{ justify-content: flex-start; }
}
`

    function PanelIcon() {
      return h('svg', {
        viewBox: '0 0 24 24', width: 16, height: 16, 'aria-hidden': true, fill: 'currentColor',
      },
        h('path', { d: 'M3 4h18v7H3z', opacity: 0.92 }),
        h('path', { d: 'M3 13h18v7H3z', opacity: 0.6 }),
      )
    }

    function Row({ title, desc, meta, primary, onPrimary, secondary, onSecondary }) {
      return h('div', { className: 'dm-row' },
        h('div', null,
          h('h3', null, title),
          h('p', null, desc),
          meta ? h('span', { className: 'dm-meta' }, meta) : null,
        ),
        h('div', { className: 'dm-actions' },
          secondary ? h('button', { type: 'button', className: 'dm-btn', onClick: onSecondary }, secondary) : null,
          h('button', { type: 'button', className: 'dm-btn dm-btn--primary', onClick: onPrimary }, primary),
        ),
      )
    }

    return {
      inject: ['slots', 'uiWorkspace'],
      apply(ctx) {
        const start = (prompt) => {
          ctx.uiWorkspace.startSession(undefined, { prompt, whenDraftExists: 'append' })
        }

        function Panel() {
          return h('div', { className: 'dm-page' },
            h('style', null, CSS),
            h('div', { className: 'dm-kicker' }, 'Disk · 磁盘'),
            h('h1', { className: 'dm-title' }, '磁盘管家'),
            h('p', { className: 'dm-sub' },
              '选一个动作会开新会话，模型调用对应工具执行。扫描只读，清理默认预览；需要管理员的系统项只报告、不修改。',
            ),
            h('div', { className: 'dm-list' },
              h(Row, {
                title: '查看各盘可用空间',
                desc: '读取每个分区的容量、已用和可用率，秒级返回。',
                meta: 'disk_overview',
                primary: '查看',
                onPrimary: () => start('用 disk_overview 看一下现在各盘还剩多少空间，并指出哪个盘紧张、为什么。'),
              }),
              h(Row, {
                title: '扫描全盘占用',
                desc: '扫描所有固定盘，列出占用最高的目录与超过 1 GB 的文件。C 盘约 2–3 分钟。',
                meta: 'disk_scan · all drives',
                primary: '扫描全盘',
                onPrimary: () => start('用 disk_scan 扫描所有盘，按盘汇总占用最高的目录和最大的文件，并对比 C 盘与 D 盘的不同压力来源。'),
              }),
              h(Row, {
                title: '只看 C 盘',
                desc: '系统盘单独看：Windows、休眠、页面文件、用户目录各占多少。',
                meta: 'disk_scan · C',
                primary: '扫描 C',
                onPrimary: () => start('用 disk_scan 扫描 C 盘，指出系统项（Windows、hiberfil、pagefile）各占多少，哪些可以动、哪些不能动。'),
              }),
              h(Row, {
                title: '只看 D 盘',
                desc: '数据盘单独看：模型、素材、项目各自的体积。',
                meta: 'disk_scan · D',
                primary: '扫描 D',
                onPrimary: () => start('用 disk_scan 扫描 D 盘，按类别归纳模型、素材、项目各占多少，哪些适合归档。'),
              }),
              h(Row, {
                title: '预览可清理的缓存',
                desc: 'Temp、CrashDumps、pip、npm、pnpm、uv 六类白名单，只统计不删除。',
                meta: 'disk_clean · dry-run',
                primary: '预览缓存',
                onPrimary: () => start('用 disk_clean 预览现在能清理多少缓存，列出每类的大小，先不要删除。'),
              }),
              h(Row, {
                title: '规整工作区',
                desc: '把工作区按「项目- / 实验- / 工具-」统一命名，空工作区可一并清理；默认只预览。',
                meta: 'workspace_tidy · dry-run',
                primary: '预览规整',
                onPrimary: () => start('用 workspace_tidy 预览一下现在的工作区，指出哪些命名不规范、哪些是空工作区，先不要改。'),
              }),
            ),
            h('div', { className: 'dm-foot' },
              h('div', null, h('span', { className: 'dm-tag' }, '白名单'), '用户 Temp（7 天以上）、CrashDumps、pip、npm、pnpm、uv 缓存'),
              h('div', null, h('span', { className: 'dm-tag' }, '不修改'), 'Windows、Program Files、回收站、休眠文件——只报告，需管理员权限的项不代做'),
              h('div', null, h('span', { className: 'dm-tag' }, '默认安全'), '清理默认 dry-run，确认后才执行；只删文件，不删目录'),
            ),
          )
        }

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
        }, Panel))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          label: '磁盘管家',
        }, PanelIcon))
      },
    }
  },
})
