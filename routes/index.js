const schema = {
  hide: true
}

export default async function (fastify, opts) {
  fastify.get('/', { schema }, async function (request, reply) {
    reply.redirect('/docs')
  })
}
