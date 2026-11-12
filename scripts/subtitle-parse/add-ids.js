#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseArgs (argv) {
  const args = {
    inFile: path.resolve(__dirname, 'out/missing.json'),
    outFile: path.resolve(__dirname, 'out/missing_id.json'),
    overwriteExistingIds: false
  }

  const rest = argv.slice(2)
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a === '--in') args.inFile = path.resolve(process.cwd(), rest[++i])
    else if (a === '--out') args.outFile = path.resolve(process.cwd(), rest[++i])
    else if (a === '--overwrite-ids') args.overwriteExistingIds = true
    else if (a === '-h' || a === '--help') args.help = true
    else throw new Error(`Unknown arg: ${a}`)
  }

  return args
}

function printHelp () {
  const cmd = `node ${path.relative(process.cwd(), path.join(__dirname, 'add-ids.js'))}`
  // eslint-disable-next-line no-console
  console.log(
    [
      'Usage:',
      `  ${cmd} [options]`,
      '',
      'Options:',
      '  --in <path>            Input JSON array (default: ./out/missing.json)',
      '  --out <path>           Output JSON array (default: ./out/missing_id.json)',
      '  --overwrite-ids        Replace id fields if already present',
      '  -h, --help             Show help'
    ].join('\n')
  )
}

async function main () {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  const raw = await fs.readFile(args.inFile, 'utf8')
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) {
    throw new Error(`Expected input to be a JSON array (got ${typeof data})`)
  }

  const seen = new Set()
  const out = data.map((item) => {
    const obj = item && typeof item === 'object' ? { ...item } : {}
    const hasId = typeof obj.id === 'string' && obj.id.trim()
    if (hasId && !args.overwriteExistingIds) {
      if (seen.has(obj.id)) throw new Error(`Duplicate existing id encountered: ${obj.id}`)
      seen.add(obj.id)
      return obj
    }

    let id = crypto.randomUUID()
    while (seen.has(id)) id = crypto.randomUUID()
    obj.id = id
    seen.add(id)
    return obj
  })

  await fs.mkdir(path.dirname(args.outFile), { recursive: true })
  await fs.writeFile(args.outFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  // eslint-disable-next-line no-console
  console.log(`Wrote ${out.length} items to ${args.outFile}`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})
