import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper.js'

test('list reports route', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/api/v1/reports'
  })
  assert.strictEqual(JSON.parse(res.payload).reports.length, 677)
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
})

test('list reports route : category', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/api/v1/reports?category=Running On Empty'
  })
  assert.strictEqual(JSON.parse(res.payload).reports.length, 477)
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
})

test('list reports route : min_rating', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/api/v1/reports?min_rating=5.4'
  })
  assert.strictEqual(JSON.parse(res.payload).reports.length, 548)
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
})

test('list reports route : max_rating', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/api/v1/reports?max_rating=5.4'
  })
  assert.strictEqual(JSON.parse(res.payload).reports.length, 46)
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
})

test('list reports route : min_date', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/api/v1/reports?min_date=2015-01-01'
  })
  assert.strictEqual(JSON.parse(res.payload).reports.length, 430)
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
})

test('list reports route : max_date', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/api/v1/reports?max_date=2015-01-01'
  })
  assert.strictEqual(JSON.parse(res.payload).reports.length, 247)
  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
})

test('get report route', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/api/v1/reports/0b399d91-1673-4708-ba60-f1312b037b35'
  })
  assert.deepStrictEqual(JSON.parse(res.payload), {
    report: {
      product: '5 Hour Energy Pomegranate',
      manufacturer: 'Living Essentials',
      category: 'Energy Crisis',
      videoTitle: 'Energy Crisis--Energy Drink Review',
      videoCode: 'wyD3nCv_emI',
      dateReleased: '2011-02-20',
      rating: 7,
      id: '0b399d91-1673-4708-ba60-f1312b037b35'
    }
  })
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
})

test('get report route : invalid id', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/api/v1/reports/not-real-id'
  })
  assert.deepStrictEqual(JSON.parse(res.payload), {
    statusCode: 404, error: 'Not Found', message: 'Report with id not-real-id not found'
  })
  assert.strictEqual(res.statusCode, 404)
  assert.strictEqual(res.headers['content-type'], 'application/json; charset=utf-8')
})
