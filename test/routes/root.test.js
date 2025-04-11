import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper.js'

test('root route redirect', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/'
  })
  assert.strictEqual(res.statusCode, 302)
})
