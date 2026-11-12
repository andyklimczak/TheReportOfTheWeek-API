#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function run (command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: __dirname, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

async function main () {
  const argv = process.argv.slice(2)
  if (argv.includes('-h') || argv.includes('--help')) {
    // eslint-disable-next-line no-console
    console.log(
      [
        'Wrapper (kept for convenience): runs download + parse.',
        '',
        'Example:',
        '  node subtitle-parse.js --after 2018-09-01 --playlist-end 25 --max-videos 5',
        '',
        'This forwards args to both scripts:',
        '  download-subtitles.js (yt-dlp) and parse-subtitles.js (OpenAI)'
      ].join('\n')
    )
    return
  }

  await run('node', ['download-subtitles.js', ...argv])
  if (argv.includes('--cache-only')) return
  await run('node', ['parse-subtitles.js', ...argv])
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})
