#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseArgs (argv) {
  const args = {
    channel: 'https://www.youtube.com/@TheReportOfTheWeek/videos',
    after: null,
    reports: path.resolve(__dirname, '../../data/reports.json'),
    subsDir: path.resolve(__dirname, 'tmp/subs'),
    archive: path.resolve(__dirname, 'tmp/download-archive.txt'),
    playlistEnd: null,
    sleepRequests: null,
    minSleepInterval: null,
    maxSleepInterval: null,
    ignoreErrors: true,
    allowOverwrites: false,
    breakOnDate: true,
    cacheOnly: false
  }

  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '--channel') args.channel = rest[++i]
    else if (a === '--after') args.after = rest[++i]
    else if (a === '--reports') args.reports = path.resolve(process.cwd(), rest[++i])
    else if (a === '--subs-dir') args.subsDir = path.resolve(process.cwd(), rest[++i])
    else if (a === '--archive') args.archive = path.resolve(process.cwd(), rest[++i])
    else if (a === '--playlist-end') args.playlistEnd = Number(rest[++i])
    else if (a === '--sleep-requests') args.sleepRequests = Number(rest[++i])
    else if (a === '--min-sleep-interval') args.minSleepInterval = Number(rest[++i])
    else if (a === '--max-sleep-interval') args.maxSleepInterval = Number(rest[++i])
    else if (a === '--abort-on-error') args.ignoreErrors = false
    else if (a === '--allow-overwrites') args.allowOverwrites = true
    else if (a === '--no-break-on-date') args.breakOnDate = false
    else if (a === '--cache-only') args.cacheOnly = true
    // parse-subtitles.js flags (ignored here, but allowed so subtitle-parse.js can forward args to both)
    else if (a === '--model') i++
    else if (a === '--max-videos') i++
    else if (a === '--limit') i++
    else if (a === '--print-first') i++
    else if (a === '--out') i++
    else if (a === '--dry-run') continue
    else if (a === '--no-openai') continue
    else if (a === '-h' || a === '--help') args.help = true
    else throw new Error(`Unknown arg: ${a}`)
  }

  return args
}

function printHelp () {
  const cmd = `node ${path.relative(process.cwd(), path.join(__dirname, 'download-subtitles.js'))}`
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      `  ${cmd} --after YYYY-MM-DD [options]`,
      '',
      'Options:',
      '  --channel <url>        YouTube channel videos URL',
      '  --reports <path>       Path to data/reports.json (for dedupe archive seeding)',
      '  --subs-dir <dir>       Directory to store .vtt + .info.json (default: ./tmp/subs)',
      '  --archive <path>       yt-dlp download archive path (default: ./tmp/download-archive.txt)',
      '  --playlist-end <n>     Cap playlist processing (passes through to yt-dlp)',
      '  --sleep-requests <s>   Sleep between requests (passes through to yt-dlp)',
      '  --min-sleep-interval <s>  Random sleep minimum (yt-dlp)',
      '  --max-sleep-interval <s>  Random sleep maximum (yt-dlp)',
      '  --abort-on-error       Fail fast if a video errors (default: keep going)',
      '  --allow-overwrites     Allow yt-dlp to overwrite existing subtitle files',
      '  --no-break-on-date     Continue scanning beyond the date cutoff',
      '  --cache-only           Only fetch missing subs for existing .info.json files (no channel crawl)',
      '  -h, --help             Show help'
    ].join('\n')
  )
}

function assertIsoDate (dateStr, flagName) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`${flagName} must be YYYY-MM-DD (got ${dateStr})`)
  }
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${flagName} is not a valid date: ${dateStr}`)
  }
  return d
}

function addDaysUtc (date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function toYtDlpDate (date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function toIsoDate (date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function ensureDir (dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function readExistingReportsVideoIds (reportsPath) {
  let raw
  try {
    raw = await fs.readFile(reportsPath, 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') return new Set()
    throw err
  }

  const json = JSON.parse(raw)
  const reports = Array.isArray(json) ? json : Array.isArray(json?.reports) ? json.reports : []
  const videoIds = new Set()
  for (const r of reports) {
    if (r && typeof r.videoCode === 'string' && r.videoCode) videoIds.add(r.videoCode)
  }
  return videoIds
}

async function readIdsFromSubsDir (subsDir) {
  const ids = new Set()
  let entries
  try {
    entries = await fs.readdir(subsDir, { withFileTypes: true })
  } catch (err) {
    if (err && err.code === 'ENOENT') return ids
    throw err
  }

  for (const e of entries) {
    if (!e.isFile()) continue
    const name = e.name
    // yt-dlp uses the video id as the start of the filename given our output template.
    // Most YouTube ids are 11 chars, but be permissive.
    const m = /^([A-Za-z0-9_-]{6,})\./.exec(name)
    if (!m) continue
    const id = m[1]
    if (!id) continue
    if (name.endsWith('.vtt') || name.endsWith('.info.json')) ids.add(id)
  }

  return ids
}

async function listVideoInfoJsonFiles (subsDir) {
  let entries
  try {
    entries = await fs.readdir(subsDir, { withFileTypes: true })
  } catch (err) {
    if (err && err.code === 'ENOENT') return []
    throw err
  }

  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.info.json'))
    .map((e) => path.join(subsDir, e.name))
}

async function listExistingVttIds (subsDir) {
  const ids = new Set()
  let entries
  try {
    entries = await fs.readdir(subsDir, { withFileTypes: true })
  } catch (err) {
    if (err && err.code === 'ENOENT') return ids
    throw err
  }

  for (const e of entries) {
    if (!e.isFile()) continue
    if (!e.name.endsWith('.vtt')) continue
    const m = /^([A-Za-z0-9_-]{6,})\./.exec(e.name)
    if (m) ids.add(m[1])
  }
  return ids
}

async function retryMissingSubsFromInfoJson ({
  subsDir,
  ytDateAfter,
  sleepRequests,
  minSleepInterval,
  maxSleepInterval
}) {
  const infoFiles = await listVideoInfoJsonFiles(subsDir)
  const vttIds = await listExistingVttIds(subsDir)
  const candidates = []
  let videoInfoJsonFiles = 0

  for (const infoPath of infoFiles) {
    const base = path.basename(infoPath)
    const id = base.endsWith('.info.json') ? base.slice(0, -'.info.json'.length) : ''
    // Skip obviously non-video infojson (channel/playlist metadata, etc.)
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) continue
    videoInfoJsonFiles++
    if (vttIds.has(id)) continue

    let uploadDate
    try {
      const info = JSON.parse(await fs.readFile(infoPath, 'utf8'))
      uploadDate = typeof info.upload_date === 'string' ? info.upload_date : ''
    } catch {
      continue
    }
    if (!/^\d{8}$/.test(uploadDate)) continue
    if (uploadDate < ytDateAfter) continue

    candidates.push({ id, infoPath })
  }

  if (!candidates.length) {
    return {
      totalInfoJsonFiles: infoFiles.length,
      videoInfoJsonFiles,
      vttFiles: vttIds.size,
      candidates: 0,
      retried: 0
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Retrying missing subtitles from cached .info.json (${candidates.length} videos)...`)

  let retried = 0
  for (let i = 0; i < candidates.length; i++) {
    const { id, infoPath } = candidates[i]
    // eslint-disable-next-line no-console
    console.log(`[retry ${i + 1}/${candidates.length}] ${id}`)

    const outputTemplate = path.join(subsDir, '%(id)s.%(ext)s')
    const args = [
      '--skip-download',
      '--write-subs',
      '--write-auto-subs',
      '--sub-lang',
      'en',
      '--sub-format',
      'vtt',
      '--no-overwrites',
      '--load-info-json',
      infoPath,
      '--output',
      outputTemplate
    ]

    if (sleepRequests != null && Number.isFinite(sleepRequests)) {
      args.push('--sleep-requests', String(sleepRequests))
    }
    if (minSleepInterval != null && Number.isFinite(minSleepInterval)) {
      args.push('--min-sleep-interval', String(minSleepInterval))
    }
    if (maxSleepInterval != null && Number.isFinite(maxSleepInterval)) {
      args.push('--max-sleep-interval', String(maxSleepInterval))
    }

    await runCommand('yt-dlp', args, { cwd: __dirname, okExitCodes: [0] })
    retried++
  }

  return {
    totalInfoJsonFiles: infoFiles.length,
    videoInfoJsonFiles,
    vttFiles: vttIds.size,
    candidates: candidates.length,
    retried
  }
}

async function seedArchive (archivePath, videoIds) {
  // Keep any existing archive entries, and append missing ids from reports.json.
  let existing = ''
  try {
    existing = await fs.readFile(archivePath, 'utf8')
  } catch (err) {
    if (!(err && err.code === 'ENOENT')) throw err
  }

  const lines = new Set(
    existing
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  )
  for (const id of videoIds) {
    lines.add(`youtube ${id}`)
  }

  await ensureDir(path.dirname(archivePath))
  await fs.writeFile(archivePath, `${Array.from(lines).sort().join('\n')}\n`, 'utf8')
}

function runCommand (command, args, { cwd, okExitCodes = [0] }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let combined = ''
    const append = (chunk) => {
      combined += chunk
      if (combined.length > 200_000) combined = combined.slice(-200_000)
    }

    child.stdout.on('data', (d) => {
      process.stdout.write(d)
      append(d.toString('utf8'))
    })
    child.stderr.on('data', (d) => {
      process.stderr.write(d)
      append(d.toString('utf8'))
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (okExitCodes.includes(code)) return resolve()

      // Treat YouTube session rate-limit as a "soft" failure so you can rerun later
      // and resume via download archive.
      const rateLimited =
        combined.includes('rate-limited by YouTube') ||
        combined.includes("This content isn't available, try again later")
      if (rateLimited) {
        // eslint-disable-next-line no-console
        console.warn(
          '\nDetected YouTube rate-limit. Exiting without error so you can retry later (download archive preserves progress).'
        )
        return resolve()
      }

      return reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

async function main () {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  if (!args.after) throw new Error('Missing required --after YYYY-MM-DD')
  const afterDate = assertIsoDate(args.after, '--after')
  const strictAfterStart = addDaysUtc(afterDate, 1)
  const ytDateAfter = toYtDlpDate(strictAfterStart)

  await ensureDir(args.subsDir)

  const existingVideoIds = await readExistingReportsVideoIds(args.reports)
  const cachedIds = await readIdsFromSubsDir(args.subsDir)
  await seedArchive(args.archive, new Set([...existingVideoIds, ...cachedIds]))

  // First, try to finish subtitle downloads for any videos we already have infojson for.
  // This avoids re-downloading video metadata pages on retries (yt-dlp --load-info-json).
  const retrySummary = await retryMissingSubsFromInfoJson({
    subsDir: args.subsDir,
    ytDateAfter,
    sleepRequests: args.sleepRequests,
    minSleepInterval: args.minSleepInterval,
    maxSleepInterval: args.maxSleepInterval
  })

  if (args.cacheOnly) {
    // eslint-disable-next-line no-console
    console.log(
      [
        'cache-only mode complete.',
        `- Found ${retrySummary.totalInfoJsonFiles} *.info.json files (${retrySummary.videoInfoJsonFiles} video infojson).`,
        `- Found ${retrySummary.vttFiles} *.vtt files.`,
        `- Missing subtitles to retry (after cutoff): ${retrySummary.candidates}.`,
        retrySummary.candidates === 0
          ? 'Nothing to do. To crawl the channel for new videos, rerun without --cache-only.'
          : `Retried ${retrySummary.retried} videos.`
      ].join('\n')
    )
    return
  }

  // eslint-disable-next-line no-console
  console.log(
    `Downloading captions after ${toIsoDate(afterDate)} (strictly after => yt-dlp --dateafter ${ytDateAfter})`
  )

  const outputTemplate = path.join(args.subsDir, '%(id)s.%(ext)s')
  const ytdlpArgs = [
    args.channel,
    '--skip-download',
    '--write-info-json',
    '--no-write-playlist-metafiles',
    '--write-subs',
    '--write-auto-subs',
    '--sub-lang',
    'en',
    '--sub-format',
    'vtt',
    '--dateafter',
    ytDateAfter,
    ...(args.breakOnDate ? ['--break-match-filters', `upload_date >= ${ytDateAfter}`] : []),
    ...(args.ignoreErrors ? ['--ignore-errors'] : []),
    ...(args.allowOverwrites ? [] : ['--no-overwrites']),
    '--download-archive',
    args.archive,
    '--output',
    outputTemplate
  ]

  if (args.playlistEnd && Number.isFinite(args.playlistEnd)) {
    ytdlpArgs.push('--playlist-end', String(args.playlistEnd))
  }

  if (args.sleepRequests != null && Number.isFinite(args.sleepRequests)) {
    ytdlpArgs.push('--sleep-requests', String(args.sleepRequests))
  }
  if (args.minSleepInterval != null && Number.isFinite(args.minSleepInterval)) {
    ytdlpArgs.push('--min-sleep-interval', String(args.minSleepInterval))
  }
  if (args.maxSleepInterval != null && Number.isFinite(args.maxSleepInterval)) {
    ytdlpArgs.push('--max-sleep-interval', String(args.maxSleepInterval))
  }

  // yt-dlp uses exit code 101 when aborting via --break-match-filters.
  const okExitCodes = args.breakOnDate ? [0, 101] : [0]
  await runCommand('yt-dlp', ytdlpArgs, { cwd: __dirname, okExitCodes })
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})
