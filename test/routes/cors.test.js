import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from '../helper.js'

const { reports: allReports } = JSON.parse(await readFile(new URL('../../data/reports.json', import.meta.url), 'utf8'))
const origin = 'http://127.0.0.1:4173'

function assertCors (res) {
  assert.equal(res.headers['access-control-allow-origin'], '*')
  assert.equal(res.headers['access-control-allow-credentials'], undefined)
}

for (const url of ['/api/v1/reports', '/api/v1/reports/']) {
  test(`CORS: ${url}`, async (t) => {
    const app = await build(t)
    const headers = { origin }
    const sortedReports = [...allReports].sort((a, b) => b.dateReleased.localeCompare(a.dateReleased))

    await t.test('GET preserves the full response and sorting', async () => {
      const res = await app.inject({ url, headers })

      assert.equal(res.statusCode, 200)
      assertCors(res)
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
      assert.deepEqual(res.json(), { reports: sortedReports })
    })

    await t.test('GET preserves category, rating and date filters', async () => {
      const queries = [
        { category: 'Energy Crisis', min_rating: '8' },
        { category: 'Energy Crisis' },
        { min_rating: '8', max_rating: '9' },
        { min_date: '2015-01-01', max_date: '2020-12-31' },
        { category: 'Energy Crisis', min_rating: '8', max_rating: '9', min_date: '2015-01-01', max_date: '2020-12-31' }
      ]

      for (const query of queries) {
        const expected = sortedReports.filter(report =>
          (!query.category || report.category === query.category) &&
          (!query.min_rating || report.rating >= Number(query.min_rating)) &&
          (!query.max_rating || report.rating <= Number(query.max_rating)) &&
          (!query.min_date || report.dateReleased >= query.min_date) &&
          (!query.max_date || report.dateReleased <= query.max_date)
        )
        assert.ok(expected.length > 0)

        const res = await app.inject({ url: `${url}?${new URLSearchParams(query)}`, headers })

        assert.equal(res.statusCode, 200)
        assertCors(res)
        assert.deepEqual(res.json(), { reports: expected })
      }
    })

    await t.test('HEAD is readable cross-origin without a response body', async () => {
      const res = await app.inject({ method: 'HEAD', url: `${url}?category=Energy%20Crisis&min_rating=8`, headers })

      assert.equal(res.statusCode, 200)
      assertCors(res)
      assert.equal(res.payload, '')
    })

    await t.test('OPTIONS preflight allows GET, HEAD and OPTIONS', async () => {
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        const res = await app.inject({
          method: 'OPTIONS',
          url: `${url}?category=Energy%20Crisis&min_rating=8`,
          headers: {
            ...headers,
            'access-control-request-method': method,
            'access-control-request-headers': 'content-type'
          }
        })

        assert.equal(res.statusCode, 204)
        assertCors(res)
        assert.deepEqual(res.headers['access-control-allow-methods'].split(/,\s*/), ['GET', 'HEAD', 'OPTIONS'])
        assert.equal(res.headers['access-control-allow-headers'], 'content-type')
        assert.equal(res.payload, '')
      }
    })

    await t.test('invalid queries retain validation errors and CORS headers', async () => {
      for (const query of ['category=Invalid', 'min_rating=11', 'max_rating=invalid', 'min_date=not-a-date', 'max_date=not-a-date']) {
        const res = await app.inject({ url: `${url}?${query}`, headers })
        const withoutOrigin = await app.inject({ url: `${url}?${query}` })

        assert.equal(res.statusCode, 400)
        assertCors(res)
        assert.equal(res.json().error, 'Bad Request')
        assert.deepEqual(res.json(), withoutOrigin.json())
      }
    })
  })
}

test('CORS: report detail and not-found responses', async (t) => {
  const app = await build(t)

  for (const id of [allReports[0].id, 'not-real-id']) {
    const url = `/api/v1/reports/${id}`
    const res = await app.inject({ url, headers: { origin: 'https://example.com' } })
    const withoutOrigin = await app.inject({ url })

    assert.equal(res.statusCode, id === 'not-real-id' ? 404 : 200)
    assertCors(res)
    assert.deepEqual(res.json(), withoutOrigin.json())
  }
})
