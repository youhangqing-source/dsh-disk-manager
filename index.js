/**
 * Disk manager: drive overview, directory scan, and whitelist cleanup tools.
 * Host-only plugin — it registers model-facing tools and runs local processes.
 */
import { spawnSync } from 'node:child_process'
import { statfsSync } from 'node:fs'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

export const name = 'disk-manager'
export const inject = ['tools']

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCAN_PS1 = path.join(HERE, 'scripts', 'scan.ps1')

const GB = 1024 ** 3
const MB = 1024 ** 2

const TEXT_OUTPUT = {
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: {
      text: { type: 'string', description: 'Human-readable result.' },
    },
  },
  render: (_args, value) => [{ type: 'text', text: value.text }],
}

function existingDrives() {
  const found = []
  for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    const root = `${letter}:\\`
    try {
      const s = statfsSync(root)
      const total = Number(s.blocks) * Number(s.bsize)
      if (!Number.isFinite(total) || total <= 0) continue
      const free = Number(s.bavail) * Number(s.bsize)
      found.push({ letter, root, total, free })
    } catch {
      // not a mountable drive
    }
  }
  return found
}

function formatOverview() {
  const drives = existingDrives()
  if (drives.length === 0) return '没有检测到任何分区。'
  const lines = drives.map((d) => {
    const used = d.total - d.free
    const pct = d.total > 0 ? (d.free / d.total) * 100 : 0
    return `${d.letter}: 总 ${(d.total / GB).toFixed(1)} GB · 已用 ${(used / GB).toFixed(1)} GB · 可用 ${(d.free / GB).toFixed(1)} GB (${pct.toFixed(1)}%)`
  })
  return lines.join('\n')
}

function summarizeScan(jsonPath, letter) {
  // Windows PowerShell's `Set-Content -Encoding UTF8` emits a BOM; strip it before parsing.
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, ''))
  const top = (raw.Top || []).slice(0, 8)
  const big = (raw.BigFiles || []).slice(0, 5)
  const parts = [
    `${letter}: 扫描 ${raw.TotalGB} GB / ${raw.TotalFiles} 个文件，用时 ${raw.ElapsedSec}s，无法访问 ${raw.Errors} 处`,
    '占用最高的目录：',
    ...top.map((t) => `  ${t.GB} GB  ${t.Name}`),
  ]
  if (big.length > 0) {
    parts.push('最大的文件：')
    for (const f of big) parts.push(`  ${f.GB} GB  ${f.Path}`)
  }
  return parts.join('\n')
}

function runScan(letter) {
  const out = path.join(os.tmpdir(), `dsh-disk-${letter}-${Date.now()}.json`)
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCAN_PS1,
      '-Root', `${letter}:\\`, '-OutFile', out, '-MinBigGB', '1', '-MinTopMB', '100',
    ],
    { encoding: 'utf8', timeout: 20 * 60 * 1000, windowsHide: true },
  )
  if (result.error) throw result.error
  if (!fs.existsSync(out)) {
    throw new Error(`扫描 ${letter}: 没有生成结果文件。stderr: ${(result.stderr || '').slice(0, 400)}`)
  }
  try {
    return summarizeScan(out, letter)
  } finally {
    try { fs.unlinkSync(out) } catch { /* ignore */ }
  }
}

const WHITELIST = [
  { name: '用户 Temp', dir: () => os.tmpdir(), days: 7 },
  { name: 'CrashDumps', dir: () => path.join(process.env.LOCALAPPDATA || '', 'CrashDumps'), days: 0 },
  { name: 'pip 下载缓存', dir: () => path.join(process.env.LOCALAPPDATA || '', 'pip', 'Cache'), days: 0 },
  { name: 'npm 缓存', dir: () => path.join(process.env.LOCALAPPDATA || '', 'npm-cache'), days: 30 },
  { name: 'pnpm 缓存', dir: () => path.join(process.env.LOCALAPPDATA || '', 'pnpm-cache'), days: 30 },
  { name: 'uv 缓存', dir: () => path.join(process.env.LOCALAPPDATA || '', 'uv'), days: 30 },
]

function collectFiles(root, days, acc, budget = { left: 300000 }) {
  if (budget.left <= 0) return
  let entries
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return
  }
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  for (const entry of entries) {
    if (budget.left <= 0) return
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      collectFiles(full, days, acc, budget)
      continue
    }
    if (!entry.isFile()) continue
    budget.left -= 1
    try {
      const st = fs.statSync(full)
      const isPart = /\.part\d*$/i.test(entry.name)
      if (isPart || st.mtimeMs < cutoff) acc.push({ path: full, size: st.size })
    } catch {
      // locked or vanished
    }
  }
}

function cleanWhitelist(execute) {  const lines = []
  let totalBytes = 0
  let totalFiles = 0
  for (const item of WHITELIST) {
    const dir = item.dir()
    if (!dir || !fs.existsSync(dir)) continue
    const files = []
    collectFiles(dir, item.days, files)
    const bytes = files.reduce((sum, f) => sum + f.size, 0)
    totalBytes += bytes
    totalFiles += files.length
    if (execute) {
      let removed = 0
      for (const f of files) {
        if (!f.path.toLowerCase().startsWith(dir.toLowerCase())) continue
        try {
          fs.unlinkSync(f.path)
          removed += 1
        } catch {
          // keep going on locked files
        }
      }
      lines.push(`${item.name}: ${files.length} 个 / ${(bytes / MB).toFixed(0)} MB，已删除 ${removed} 个`)
    } else {
      lines.push(`${item.name}: ${files.length} 个 / ${(bytes / MB).toFixed(0)} MB  ${dir}`)
    }
  }
  if (lines.length === 0) return '白名单目录都不存在，没有可清理项。'
  const mode = execute ? '已执行清理' : '预览（未删除，加 execute: true 才执行）'
  lines.push('', `${mode} · 合计 ${totalFiles} 个文件 / ${(totalBytes / MB).toFixed(0)} MB`)
  return lines.join('\n')
}

const WORKSPACE_JSON = path.join(os.homedir(), '.dsh', 'storages', 'workspace.json')

const CATEGORY_RULES = [
  { re: /测试|实验|test|sandbox|github/i, prefix: '实验-' },
  { re: /工具|workspace|管家|tool/i, prefix: '工具-' },
]

function proposeTitle(title) {
  const base = String(title || '').replace(/^dsh-/i, '').trim()
  if (!base) return undefined
  if (/^(项目|实验|工具)-/.test(base)) return undefined
  for (const rule of CATEGORY_RULES) if (rule.re.test(base)) return rule.prefix + base
  return '项目-' + base
}

function countFiles(dir, budget = { left: 50000 }) {  let n = 0
  const walk = (d) => {
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (budget.left-- <= 0) return
      if (e.isDirectory()) walk(path.join(d, e.name))
      else if (e.isFile()) n += 1
    }
  }
  walk(dir)
  return n
}

/**
 * Session logs live under ~/.dsh/sessions/<bucket>, where the bucket name is the
 * working directory path with ':' removed, '\' turned into '-', and non-ASCII
 * characters escaped as ~XXXX (uppercase UTF-16 code unit). Renaming a workspace
 * folder without renaming its bucket makes every conversation in it unreachable.
 */
function sessionBucketName(dir) {
  const flat = dir.replace(/:/g, '').replace(/\\/g, '-')
  let escaped = ''
  for (const ch of flat) {
    const code = ch.codePointAt(0)
    escaped += code > 127 ? `~${code.toString(16).toUpperCase().padStart(4, '0')}` : ch
  }
  return `--${escaped}--`
}

function moveSessionBucket(fromDir, toDir, log) {
  const sessionsRoot = path.join(os.homedir(), '.dsh', 'sessions')
  const from = path.join(sessionsRoot, sessionBucketName(fromDir))
  const to = path.join(sessionsRoot, sessionBucketName(toDir))
  try {
    if (!fs.existsSync(from) || fs.existsSync(to)) return
    fs.renameSync(from, to)
    log.push('  ↳ 会话桶已同步（对话可继续打开）')
  } catch (error) {
    log.push(`  ↳ 会话桶同步失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

function tidyWorkspaces(execute, removeEmpty, linkOld) {
  if (!fs.existsSync(WORKSPACE_JSON)) return '找不到 workspace.json，这个 profile 可能还没有工作区。'
  const raw = fs.readFileSync(WORKSPACE_JSON, 'utf8')
  const state = JSON.parse(raw.replace(/^\uFEFF/, ''))
  const rows = []
  for (const [id, w] of Object.entries(state.tables.workspaces)) {
    const exists = fs.existsSync(w.path)
    const files = exists ? countFiles(w.path) : -1
    rows.push({ id, w, exists, files, proposal: proposeTitle(w.title || path.basename(w.path)) })
  }

  const lines = [`现有 ${rows.length} 个工作区：`]
  for (const r of rows) {
    const status = !r.exists ? '目录不存在' : r.files === 0 ? '空目录' : `${r.files} 个文件`
    const isCwd = r.w.path.toLowerCase() === process.cwd().toLowerCase()
    const hint = r.proposal ? (isCwd ? '（不改：当前会话目录）' : ` → ${r.proposal}`) : ''
    lines.push(`  ${r.w.title}  [${status}]  ${r.w.path}${hint}`)
  }

  if (!execute) {
    lines.push('', '以上是预览。执行请传 execute: true；要顺带清掉空工作区再加 removeEmpty: true。')
    return lines.join('\n')
  }

  fs.writeFileSync(`${WORKSPACE_JSON}.bak-${Date.now()}`, raw, 'utf8')
  const done = []
  for (const r of rows) {
    const isCwd = r.w.path.toLowerCase() === process.cwd().toLowerCase()
    if ((!r.exists || r.files === 0) && removeEmpty) {
      delete state.tables.workspaces[r.id]
      state.global.workspaceIds = state.global.workspaceIds.filter((x) => x !== r.id)
      done.push(`移除 ${r.w.title}（${r.exists ? '空目录' : '目录不存在'}）`)
      continue
    }
    if (!r.proposal || isCwd) continue
    const target = path.join(path.dirname(r.w.path), r.proposal)
    if (fs.existsSync(target)) {
      done.push(`跳过 ${r.w.title}：${r.proposal} 已存在`)
      continue
    }
    const oldBucket = path.join(os.homedir(), '.dsh', 'sessions', sessionBucketName(r.w.path))
    const hadSessions = fs.existsSync(oldBucket)
    try {
      const from = r.w.path
      fs.renameSync(from, target)
      state.tables.workspaces[r.id].path = target
      state.tables.workspaces[r.id].title = r.proposal
      done.push(`改名 ${r.w.title} → ${r.proposal}`)
      moveSessionBucket(from, target, done)
      if (hadSessions) {
        if (linkOld) {
          try {
            fs.symlinkSync(target, from, 'junction')
            done.push('  ↳ 旧路径已建 junction：历史会话保存的 cwd 仍然可访问')
          } catch (error) {
            done.push(`  ↳ junction 创建失败：${error instanceof Error ? error.message : String(error)}`)
          }
        } else {
          done.push('  ↳ 该工作区有历史会话，旧路径已不存在；恢复对话会报 working-directory 错误。需要时加 linkOld: true')
        }
      }
    } catch (error) {
      done.push(`改名失败 ${r.w.title}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  fs.writeFileSync(WORKSPACE_JSON, JSON.stringify(state, null, 2), 'utf8')
  done.push('', '已写回 workspace.json（同目录留有 .bak 备份），重启桌面版后生效。')
  return done.join('\n')
}

export function apply(ctx) {
  ctx.tools.register({
    name: 'disk_overview',
    description: '列出本机各分区的总容量、已用和可用空间，并给出可用率。用于快速判断哪个盘紧张。',
    parameters: {},
    output: TEXT_OUTPUT,
    execute() {
      return Promise.resolve({ text: formatOverview() })
    },
  })

  ctx.tools.register({
    name: 'disk_scan',
    description:
      '扫描一个或多个盘的目录占用与超过 1GB 的大文件，返回占用最高的目录列表。drives 留空则扫描所有固定盘；C 盘约 2-3 分钟，多盘会更久。',
    parameters: {
      drives: {
        type: 'string',
        description: '逗号分隔的盘符，例如 C,D 或 D；留空表示扫描所有固定盘。',
      },
    },
    output: TEXT_OUTPUT,
    execute(args) {
      const requested = String(args.drives || '')
        .toUpperCase()
        .replace(/[^A-Z,，\s]/g, '')
        .split(/[,，\s]+/)
        .filter(Boolean)
      const all = existingDrives().map((d) => d.letter)
      const letters = requested.length > 0 ? requested : all
      const invalid = letters.filter((l) => !all.includes(l))
      if (invalid.length > 0) {
        throw new Error(`这些盘不存在或不可访问: ${invalid.join(', ')}；可用盘: ${all.join(', ')}`)
      }
      const sections = []
      for (const letter of letters) {
        try {
          sections.push(runScan(letter))
        } catch (error) {
          sections.push(`${letter}: 扫描失败 — ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      return Promise.resolve({ text: sections.join('\n\n') })
    },
  })

  ctx.tools.register({
    name: 'disk_clean',
    description:
      '按白名单清理缓存：用户 Temp（7 天以上）、CrashDumps、pip、npm、pnpm、uv 缓存。默认只预览不删除；execute=true 才真正删除。不触碰任何其他路径。',
    parameters: {
      execute: {
        type: 'boolean',
        description: 'true 才执行删除；省略或 false 仅预览。',
      },
    },
    output: TEXT_OUTPUT,
    execute(args) {
      return Promise.resolve({ text: cleanWhitelist(Boolean(args.execute)) })
    },
  })

  ctx.tools.register({
    name: 'workspace_tidy',
    description:
      '检查并规整 DSH 工作区：列出每个工作区的路径、体积、会话数与建议命名；execute=true 时按「项目-/实验-/工具-」前缀重命名目录并同步 workspace.json 与会话桶，removeEmpty=true 时移除目录为空的工区，linkOld=true 时在旧路径建 junction 以保住历史会话的 cwd。默认只预览，改名与删除都会先备份 workspace.json。',
    parameters: {
      execute: { type: 'boolean', description: 'true 才真正改名/移除；省略仅预览。' },
      removeEmpty: { type: 'boolean', description: '配合 execute 使用：把目录为空或已不存在的工作区从列表移除。' },
      linkOld: { type: 'boolean', description: '配合 execute 使用：改名后在有历史会话的旧路径上建 junction，使历史对话仍能打开。' },
    },
    output: TEXT_OUTPUT,
    execute(args) {
      return Promise.resolve({ text: tidyWorkspaces(Boolean(args.execute), Boolean(args.removeEmpty), Boolean(args.linkOld)) })
    },
  })
}
