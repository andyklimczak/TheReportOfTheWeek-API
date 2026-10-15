# The Report of the Week API

API to provide information on reviews by [The Report of the Week](https://www.youtube.com/user/TheReportOfTheWeek)

## Endpoints & Docs

Checkout the [OpenAPI Docs](https://thereportoftheweekapi.com/docs) for more info and to test the endpoints.

The base URL is `https://thereportoftheweekapi.com`.

## Browser access (CORS)

These are public, read-only endpoints. The application uses `@fastify/cors` 11.x
(compatible with Fastify 5.x), registered before the routes, with this policy:

- `Access-Control-Allow-Origin: *` on responses, including validation errors.
- Allowed methods: `GET`, `HEAD`, and `OPTIONS`; valid preflights return `204`.
- No credentialed CORS: `Access-Control-Allow-Credentials` is not sent. Do not
  use `credentials: 'include'`.

Both `/api/v1/reports` and `/api/v1/reports/` support query parameters and
cross-origin requests. Use ordinary browser `fetch()`; no proxy or `no-cors`
workaround is needed:

```js
const response = await fetch(
  'https://thereportoftheweekapi.com/api/v1/reports?category=Energy%20Crisis&min_rating=8'
);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const { reports } = await response.json();
console.log(reports);
```

### Deployment and proxy/cache checks

`.github/workflows/ci.yml` deploys to Dokku automatically after tests pass on a
push to `master`. **Do not push to `master` or deploy without approval.** The
repository contains no nginx configuration; the live nginx/Dokku and any
upstream cache/CDN configuration must be checked on the deployment host.

After deployment is approved:

1. Deploy the updated application and lockfile through the existing workflow,
   ensuring dependencies are installed and the new app process is running.
2. Let Fastify own CORS. In nginx and any other proxy/CDN, remove rules such as
   `proxy_hide_header Access-Control-Allow-Origin` or header-rewrite rules that
   strip application CORS headers. Remove proxy `add_header Access-Control-*`
   directives that would duplicate or conflict with Fastify's headers. Ensure
   `OPTIONS` is forwarded to the application rather than blocked or intercepted.
   Inspect effective configuration (for example, `nginx -T`), validate any nginx
   changes with `nginx -t`, then reload nginx if needed.
3. Purge/invalidate any cached API responses and preflight responses that lack
   CORS headers, including both trailing-slash variants and query-string cache
   entries. Preserve CORS headers on cache hits and errors. If preflight responses
   are cached, respect `Vary: Access-Control-Request-Headers` (or bypass caching
   for `OPTIONS`). Clear/disable browser caches when retesting.
4. Verify the **public HTTPS URL**, not just localhost. For each path, these
   requests should return `200`, `204`, and `400` respectively, each with exactly
   one `Access-Control-Allow-Origin: *` header and no
   `Access-Control-Allow-Credentials`. The preflight must advertise
   `GET, HEAD, OPTIONS`:

   ```bash
   for path in /api/v1/reports /api/v1/reports/; do
     url="https://thereportoftheweekapi.com${path}"
     curl -i -H 'Origin: http://127.0.0.1:4173' \
       "${url}?category=Energy%20Crisis&min_rating=8"
     curl -i -X OPTIONS \
       -H 'Origin: http://127.0.0.1:4173' \
       -H 'Access-Control-Request-Method: GET' \
       -H 'Access-Control-Request-Headers: content-type' \
       "${url}?category=Energy%20Crisis&min_rating=8"
     curl -i -H 'Origin: http://127.0.0.1:4173' \
       "${url}?min_rating=11"
   done
   ```

5. Run the browser `fetch()` example above from a page on another origin (such
   as `http://127.0.0.1:4173`) and confirm JavaScript can read the JSON. A direct
   navigation, curl without an `Origin` header, or Node.js fetch alone does not
   test browser CORS enforcement. Repeat after caches warm to check cache hits.

## Data

This API returns all reviews done on The Report of the Week youtube channel.
All the reviews live in the [reports.json file](./data/reports.json) if you're just interested pulling in the data into your own datastore..

### Example Review

```json
{
  "product": "5 Hour Energy Pomegranate",
  "manufacturer": "Living Essentials",
  "category": "Energy Crisis",
  "videoTitle": "Energy Crisis--Energy Drink Review",
  "videoCode": "wyD3nCv_emI",
  "dateReleased": "2011-02-20",
  "rating": 7.0,
  "id": "0b399d91-1673-4708-ba60-f1312b037b35"
}
```

## Local Setup

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.
