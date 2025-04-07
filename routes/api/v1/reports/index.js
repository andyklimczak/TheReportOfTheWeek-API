import { JSONFilePreset } from 'lowdb/node'
import { fileURLToPath } from 'url'
import { join } from 'path'

export default async function (fastify, opts) {
  const schema = {
    querystring: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['Energy Crisis', 'Running On Empty']
        },
        min_rating: {
          type: 'number',
          minimum: 0,
          maximum: 10
        },
        max_rating: {
          type: 'number',
          minimum: 0,
          maximum: 10
        },
        min_date: {
          type: 'string',
          format: 'date'
        },
        max_date: {
          type: 'string',
          format: 'date'
        }
      }
    }
  }
  fastify.get('/', { schema }, async function (request, reply) {
    const dirname = fileURLToPath(new URL('.', import.meta.url))
    const dbPath = join(dirname, '../../../../data/reports2.json')
    const db = await JSONFilePreset(dbPath, { reports: [] })
    let reports = db.data.reports

    const categoryFilter = request.query.category
    if (categoryFilter) {
      reports = reports.filter(report => report.category === categoryFilter)
    }
    const minRatingFilter = request.query.min_rating
    if (minRatingFilter) {
      reports = reports.filter(report => report.rating >= minRatingFilter)
    }
    const maxRatingFilter = request.query.max_rating
    if (maxRatingFilter) {
      reports = reports.filter(report => report.rating <= maxRatingFilter)
    }
    const minDate = request.query.min_date
    if (minDate) {
      reports = reports.filter(report => report.dateReleased >= minDate)
    }
    const maxDate = request.query.max_date
    if (maxDate) {
      reports = reports.filter(report => report.dateReleased <= maxDate)
    }

    reports = reports.sort((a, b) => b.dateReleased.localcompare(a.dateReleased))

    return { reports }
  })

  fastify.get('/:reportId', async function (request, reply) {
    const dirname = fileURLToPath(new URL('.', import.meta.url))
    const dbPath = join(dirname, '../../../../data/reports2.json')
    const db = await JSONFilePreset(dbPath, { reports: [] })

    const { reportId } = request.params
    const report = db.data.reports.find(report => report.id === reportId)
    if (!report) {
      throw fastify.httpErrors.notFound(`Report with id ${reportId} not found`)
    }

    return { report }
  })
}
