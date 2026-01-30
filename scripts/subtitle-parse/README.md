# subtitle-parse

Downloads captions from TheReportOfTheWeek videos after a date, then uses the OpenAI API to extract:
`product`, `manufacturer`, `category`, `rating` into `out/missing.json`.

## Prereqs

- Node.js 22+
- `yt-dlp` available on PATH
- OpenAI API key (for parsing step)

## Setup

```bash
cd scripts/subtitle-parse
npm install
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env`. Optionally set `OPENAI_MODEL` (default: `gpt-5-mini`).

## Run

### 1) Download subtitles (cached)

```bash
npm run download -- --after 2018-09-01
```

To test without processing the entire channel, cap yt-dlp:

```bash
npm run download -- --after 2018-09-01 --playlist-end 25
```

Notes:

If you hit YouTube rate limits, retry later and/or add delays:

```bash
npm run download -- --after 2018-09-01 --sleep-requests 2
```

If you got rate-limited mid-run, you can retry using only what you already have cached:

```bash
npm run download -- --after 2018-09-01 --cache-only
```

Reruns are resumable:
- The downloader writes progress to `tmp/download-archive.txt`.
- It also seeds the archive from anything already present in `tmp/subs/`, so if a previous run downloaded some `.vtt` files before getting rate-limited, they won't be re-downloaded next run.
- The downloader uses `yt-dlp --break-match-filters "upload_date >= YYYYMMDD"` by default, so once it reaches videos older than your cutoff it stops scanning the channel. Disable with `--no-break-on-date`.

Subtitles are stored under `tmp/subs/` so you can re-run parsing without re-downloading.

### 2) Parse downloaded subtitles with OpenAI

```bash
npm run parse -- --after 2018-09-01
```

To test parsing cheaply / quickly:

```bash
npm run parse -- --after 2018-09-01 --limit 10 --print-first 10
```

Outputs:
- Reviews: `out/missing.json` (array of review objects, no `id`)
- Non-reviews: `out/non_reviews.json` (excluded from `out/missing.json`)
- Failures: `out/failures.json` (only if any items failed)

### 3) Add UUIDs

```bash
npm run add-ids
```

This reads `out/missing.json` and writes `out/missing_id.json`.

### Convenience wrapper (runs download + parse)

```bash
npm start -- --after 2018-09-01
```

By default both steps read existing video IDs from `../../data/reports.json` and skip duplicates.
