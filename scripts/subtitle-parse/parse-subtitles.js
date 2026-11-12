#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import OpenAI from 'openai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env') })

function parseArgs (argv) {
  const args = {
    after: null,
    reports: path.resolve(__dirname, '../../data/reports.json'),
    subsDir: path.resolve(__dirname, 'tmp/subs'),
    outDir: path.resolve(__dirname, 'out'),
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    maxVideos: null,
    printFirst: 0,
    dryRun: false,
    noOpenAI: false
  }

  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '--after') args.after = rest[++i]
    else if (a === '--reports') args.reports = path.resolve(process.cwd(), rest[++i])
    else if (a === '--subs-dir') args.subsDir = path.resolve(process.cwd(), rest[++i])
    else if (a === '--out') args.outDir = path.resolve(process.cwd(), rest[++i])
    else if (a === '--model') args.model = rest[++i]
    else if (a === '--max-videos') args.maxVideos = Number(rest[++i])
    else if (a === '--limit') args.maxVideos = Number(rest[++i])
    else if (a === '--print-first') args.printFirst = Number(rest[++i])
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--no-openai') args.noOpenAI = true
    // download-subtitles.js flags (ignored here, but allowed so subtitle-parse.js can forward args to both)
    else if (a === '--channel') i++
    else if (a === '--archive') i++
    else if (a === '--playlist-end') i++
    else if (a === '--sleep-requests') i++
    else if (a === '--min-sleep-interval') i++
    else if (a === '--max-sleep-interval') i++
    else if (a === '--abort-on-error') continue
    else if (a === '--cache-only') continue
    else if (a === '-h' || a === '--help') args.help = true
    else throw new Error(`Unknown arg: ${a}`)
  }

  return args
}

function printHelp () {
  const cmd = `node ${path.relative(process.cwd(), path.join(__dirname, 'parse-subtitles.js'))}`
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      `  ${cmd} --after YYYY-MM-DD [options]`,
      '',
      'Options:',
      '  --reports <path>       Path to data/reports.json (skip duplicates by videoCode)',
      '  --subs-dir <dir>       Directory containing downloaded .vtt + .info.json (default: ./tmp/subs)',
      '  --out <dir>            Output directory (default: ./out)',
      '  --model <id>           OpenAI model (default: env OPENAI_MODEL or gpt-5-mini)',
      '  --max-videos <n>       Limit processing to N videos',
      '  --limit <n>            Alias for --max-videos',
      '  --print-first <n>      Print the first N extracted reviews to stdout',
      '  --dry-run              Do not call OpenAI; write stub JSON only',
      '  --no-openai            Skip OpenAI parsing (same as --dry-run)',
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

function toIsoDate (date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function ensureDir (dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function readExistingReports (reportsPath) {
  let raw
  try {
    raw = await fs.readFile(reportsPath, 'utf8')
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { videoIds: new Set(), maxDateReleased: null }
    }
    throw err
  }

  const json = JSON.parse(raw)
  const reports = Array.isArray(json) ? json : Array.isArray(json?.reports) ? json.reports : []
  const videoIds = new Set()
  let max = null
  for (const r of reports) {
    if (r && typeof r.videoCode === 'string' && r.videoCode) videoIds.add(r.videoCode)
    if (r && typeof r.dateReleased === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.dateReleased)) {
      const d = new Date(`${r.dateReleased}T00:00:00Z`)
      if (!Number.isNaN(d.getTime()) && (!max || d > max)) max = d
    }
  }
  return { videoIds, maxDateReleased: max }
}

async function listInfoJsonFiles (subsDir) {
  const entries = await fs.readdir(subsDir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.info.json'))
    .map((e) => path.join(subsDir, e.name))
}

async function findBestVttForVideo (subsDir, videoId) {
  const entries = await fs.readdir(subsDir, { withFileTypes: true })
  const vtts = entries
    .filter((e) => e.isFile() && e.name.startsWith(`${videoId}.`) && e.name.endsWith('.vtt'))
    .map((e) => e.name)

  if (vtts.length === 0) return null

  vtts.sort((a, b) => {
    const aAuto = a.includes('.auto.')
    const bAuto = b.includes('.auto.')
    if (aAuto !== bAuto) return aAuto ? 1 : -1
    const aEn = /\.en(\.|-)/.test(a) || a.includes('.en.vtt')
    const bEn = /\.en(\.|-)/.test(b) || b.includes('.en.vtt')
    if (aEn !== bEn) return aEn ? -1 : 1
    return a.length - b.length
  })

  return path.join(subsDir, vtts[0])
}

function vttToText (vtt) {
  const lines = vtt.split(/\r?\n/)
  const out = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed === 'WEBVTT') continue
    if (/^\d+$/.test(trimmed)) continue
    if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(trimmed)) continue
    if (/^\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}\.\d{3}/.test(trimmed)) continue
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) continue
    if (/^(position:|align:|size:|line:)\b/.test(trimmed)) continue
    out.push(trimmed)
  }

  const deduped = []
  for (const line of out) {
    if (deduped.length && deduped[deduped.length - 1] === line) continue
    deduped.push(line)
  }

  return deduped.join('\n')
}

function buildTranscriptSnippet (fullText, { maxChars = 32000 } = {}) {
  if (fullText.length <= maxChars) return fullText
  const half = Math.floor((maxChars - 50) / 2)
  return `${fullText.slice(0, half)}\n...\n${fullText.slice(-half)}`
}

function inferCategory ({ title, transcriptText }) {
  const hay = `${title}\n${transcriptText}`.toLowerCase()
  if (hay.includes('energy crisis')) return 'Energy Crisis'
  if (hay.includes('drink review')) return 'Drink Review'
  return 'Running On Empty'
}

function inferManufacturer ({ title, product, transcriptText }) {
  const hay = `${title}\n${product}\n${transcriptText}`.toLowerCase()
  const rules = [
    { name: "McDonald's", patterns: [/\bmcdonald'?s\b/, /\bmcdonalds\b/] },
    { name: 'KFC', patterns: [/\bkfc\b/, /\bkentucky fried chicken\b/] },
    { name: 'Burger King', patterns: [/\bburger king\b/, /\bbk\b/] },
    { name: 'Taco Bell', patterns: [/\btaco bell\b/] },
    { name: "Wendy's", patterns: [/\bwendy'?s\b/] },
    { name: 'Subway', patterns: [/\bsubway\b/] },
    { name: 'Popeyes', patterns: [/\bpopeyes\b/] },
    { name: 'Chick-fil-A', patterns: [/\bchick-?fil-?a\b/] },
    { name: "Domino's", patterns: [/\bdomino'?s\b/] },
    { name: 'Pizza Hut', patterns: [/\bpizza hut\b/] },
    { name: 'Starbucks', patterns: [/\bstarbucks\b/] },
    { name: "Dunkin'", patterns: [/\bdunkin'?\b/, /\bdunkin donuts\b/] }
  ]

  for (const rule of rules) {
    for (const pat of rule.patterns) {
      if (pat.test(hay)) return rule.name
    }
  }
  return ''
}

function normalizeString (x) {
  if (typeof x !== 'string') return ''
  return x.trim()
}

function normalizeRating (x) {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x === 'string') {
    const n = Number.parseFloat(x)
    if (Number.isFinite(n)) return n
  }
  return null
}

function getResponseText (resp) {
  if (typeof resp?.output_text === 'string' && resp.output_text.trim()) return resp.output_text
  const parts = []
  const output = Array.isArray(resp?.output) ? resp.output : []
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const c of content) {
      if (typeof c?.text === 'string') parts.push(c.text)
    }
  }
  return parts.join('\n')
}

function parseJsonLenient (raw) {
  const text = String(raw ?? '').trim()
  if (!text) throw new Error('Empty response text')
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON object found in response')
    }
    const slice = text.slice(start, end + 1)
    return JSON.parse(slice)
  }
}

async function extractWithOpenAI ({ client, model, title, transcriptSnippet }) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      isReview: {
        type: 'boolean',
        description:
          'True only if this video is primarily a food/drink/energy drink review with a product being reviewed. False for vlogs, updates, commentary, etc.'
      },
      product: { type: 'string', description: 'Product name being reviewed.' },
      manufacturer: { type: 'string', description: 'Manufacturer/company/brand. Empty string if unknown.' },
      category: {
        type: 'string',
        description:
          "One of: 'Running On Empty' (food), 'Drink Review' (drinks), 'Energy Crisis' (energy drinks). Empty string if unknown."
      },
      rating: {
        description: 'Numeric rating out of 10 (may be a decimal). If the rating is not present, use null.',
        anyOf: [{ type: 'number' }, { type: 'null' }]
      },
      skipReason: {
        type: 'string',
        description:
          "If isReview is false, a short reason (e.g. 'commentary', 'channel update', 'vlog', 'non-review'). Empty string if isReview is true."
      }
    },
    required: ['isReview', 'product', 'manufacturer', 'category', 'rating', 'skipReason']
  }

  const instructions = [
    "You extract structured fields from YouTube subtitles for 'TheReportOfTheWeek' review videos.",
    'Return ONLY JSON that matches the schema (no markdown, no backticks).',
    '',
    'Not all videos are reviews.',
    '- If this video is NOT primarily a food/drink/energy drink review, set isReview=false, set product/manufacturer/category to empty strings, rating=null, and set skipReason to a short reason.',
    '- Only set isReview=true when a specific product is being reviewed and a rating is (usually) given.',
    '',
    'Category guidance:',
    "- Food reviews: 'Running On Empty'",
    "- Drink reviews: 'Drink Review'",
    "- Energy drinks: 'Energy Crisis'",
    'He commonly says the segment name in the video; prefer what he says if present.',
    '',
    'Manufacturer guidance:',
    "- You may use common knowledge (no web browsing) to fill in obvious manufacturers/brands/restaurants (e.g., Big Mac -> McDonald's, KFC bowl -> KFC).",
    '- Only do this when you are highly confident; otherwise return empty string for manufacturer.',
    '',
    'If manufacturer or category is unclear, return empty string for that field.',
    'If rating is unclear or missing, return null for rating (do not guess).'
  ].join('\n')

  const input = [`Video title: ${title}`, '', 'Subtitles excerpt:', transcriptSnippet].join('\n')

  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await client.responses.create({
        model,
        instructions:
          attempt === 1
            ? instructions
            : `${instructions}\n\nIMPORTANT: Output MUST be a single, complete JSON object. Do not truncate.`,
        input,
        max_output_tokens: attempt === 1 ? 400 : attempt === 2 ? 800 : 1200,
        text: {
          format: {
            type: 'json_schema',
            name: 'report_extraction',
            schema,
            strict: false
          }
        }
      })

      const rawText = getResponseText(resp)
      if (!rawText.trim()) throw new Error('OpenAI returned empty text')

      const parsed = parseJsonLenient(rawText)
      return {
        isReview: Boolean(parsed.isReview),
        product: normalizeString(parsed.product),
        manufacturer: normalizeString(parsed.manufacturer),
        category: normalizeString(parsed.category),
        rating: normalizeRating(parsed.rating),
        skipReason: normalizeString(parsed.skipReason)
      }
    } catch (err) {
      lastErr = err
    }
  }

  throw new Error(`OpenAI extraction failed after retries: ${lastErr?.message || String(lastErr)}`)
}

async function main () {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  if (!args.after) throw new Error('Missing required --after YYYY-MM-DD')

  const { videoIds: existingVideoIds } = await readExistingReports(args.reports)
  const afterDate = assertIsoDate(args.after, '--after')
  const strictAfterStart = addDaysUtc(afterDate, 1)

  await ensureDir(args.outDir)

  const infoFiles = await listInfoJsonFiles(args.subsDir)
  const items = []
  const stats = {
    infoJsonFiles: infoFiles.length,
    skippedNonVideoInfoJson: 0,
    skippedAlreadyInReports: 0,
    skippedBeforeCutoff: 0,
    skippedMissingVtt: 0,
    candidates: 0
  }

  for (const infoPath of infoFiles) {
    const info = JSON.parse(await fs.readFile(infoPath, 'utf8'))
    const videoCode = info.id
    if (!videoCode || typeof videoCode !== 'string') {
      stats.skippedNonVideoInfoJson++
      continue
    }
    if (existingVideoIds.has(videoCode)) {
      stats.skippedAlreadyInReports++
      continue
    }

    const uploadDate = info.upload_date // YYYYMMDD
    if (typeof uploadDate !== 'string' || !/^\d{8}$/.test(uploadDate)) {
      stats.skippedNonVideoInfoJson++
      continue
    }
    const dateReleased = `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`
    const dateReleasedObj = new Date(`${dateReleased}T00:00:00Z`)
    if (Number.isNaN(dateReleasedObj.getTime()) || dateReleasedObj < strictAfterStart) {
      stats.skippedBeforeCutoff++
      continue
    }

    const videoTitle = info.title || ''
    const vttPath = await findBestVttForVideo(args.subsDir, videoCode)
    if (!vttPath) {
      // eslint-disable-next-line no-console
      console.warn(`No .vtt subtitles found for ${videoCode} (${videoTitle})`)
      stats.skippedMissingVtt++
      continue
    }

    const vtt = await fs.readFile(vttPath, 'utf8')
    const transcriptText = vttToText(vtt)
    const transcriptSnippet = buildTranscriptSnippet(transcriptText)

    stats.candidates++
    items.push({
      videoCode,
      videoTitle,
      dateReleased,
      transcriptText,
      transcriptSnippet
    })

    if (args.maxVideos && items.length >= args.maxVideos) break
  }

  // eslint-disable-next-line no-console
  console.log(
    [
      'Parse discovery summary:',
      `- Subtitles dir: ${args.subsDir}`,
      `- Reports file: ${args.reports}`,
      `- After (strict): ${toIsoDate(afterDate)} (includes >= ${toIsoDate(strictAfterStart)})`,
      `- Found infojson: ${stats.infoJsonFiles}`,
      `- Skipped (already in reports): ${stats.skippedAlreadyInReports}`,
      `- Skipped (before cutoff): ${stats.skippedBeforeCutoff}`,
      `- Skipped (missing .vtt): ${stats.skippedMissingVtt}`,
      `- Skipped (non-video/missing upload_date): ${stats.skippedNonVideoInfoJson}`,
      `- Will process: ${items.length}${args.maxVideos ? ` (limited to ${args.maxVideos})` : ''}`
    ].join('\n')
  )

  const outPath = path.join(args.outDir, 'missing.json')

  if (args.dryRun || args.noOpenAI) {
    const stub = items.map(({ videoCode, videoTitle, dateReleased }) => ({
      product: '',
      manufacturer: '',
      category: '',
      videoTitle,
      videoCode,
      dateReleased,
      rating: null
    }))
    await fs.writeFile(outPath, `${JSON.stringify(stub, null, 2)}\n`, 'utf8')
    // eslint-disable-next-line no-console
    console.log(`Wrote stub output (no OpenAI) to ${outPath}`)
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY in environment (set in .env).')

  const client = new OpenAI({ apiKey })
  const results = []
  const failures = []
  const nonReviews = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    // eslint-disable-next-line no-console
    console.log(`[${i + 1}/${items.length}] Parsing ${item.videoCode} — ${item.videoTitle}`)

    try {
      const extracted = await extractWithOpenAI({
        client,
        model: args.model,
        title: item.videoTitle,
        transcriptSnippet: item.transcriptSnippet
      })

      if (!extracted.isReview) {
        nonReviews.push({
          videoTitle: item.videoTitle,
          videoCode: item.videoCode,
          dateReleased: item.dateReleased,
          skipReason: extracted.skipReason || 'non-review'
        })
        continue
      }

      const category = extracted.category || inferCategory({ title: item.videoTitle, transcriptText: item.transcriptText })
      const manufacturer =
        extracted.manufacturer ||
        inferManufacturer({ title: item.videoTitle, product: extracted.product, transcriptText: item.transcriptText })

      results.push({
        product: extracted.product,
        manufacturer,
        category,
        videoTitle: item.videoTitle,
        videoCode: item.videoCode,
        dateReleased: item.dateReleased,
        rating: extracted.rating
      })
    } catch (err) {
      failures.push({
        videoCode: item.videoCode,
        videoTitle: item.videoTitle,
        error: err?.message || String(err)
      })
      // eslint-disable-next-line no-console
      console.warn(`Failed to parse ${item.videoCode}: ${err?.message || err}`)
    }
  }

  await fs.writeFile(outPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8')

  if (args.printFirst && Number.isFinite(args.printFirst) && args.printFirst > 0) {
    const n = Math.max(0, Math.floor(args.printFirst))
    // eslint-disable-next-line no-console
    console.log('\nSample extracted reviews:')
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results.slice(0, n), null, 2))
  }

  if (nonReviews.length) {
    const nonReviewsPath = path.join(args.outDir, 'non_reviews.json')
    await fs.writeFile(nonReviewsPath, `${JSON.stringify(nonReviews, null, 2)}\n`, 'utf8')
    // eslint-disable-next-line no-console
    console.log(`Wrote ${nonReviews.length} non-reviews to ${nonReviewsPath}`)
  }

  if (failures.length) {
    const failuresPath = path.join(args.outDir, 'failures.json')
    await fs.writeFile(failuresPath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8')
    // eslint-disable-next-line no-console
    console.warn(`Wrote failures to ${failuresPath}`)
  }

  // eslint-disable-next-line no-console
  console.log(`Wrote ${results.length} review items to ${outPath}`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})
