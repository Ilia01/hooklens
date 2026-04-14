import Fastify from 'fastify'
import rawBody from 'fastify-raw-body'
import Stripe from 'stripe'

const app = Fastify({ logger: true })
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder')
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

if (!webhookSecret) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET')
}

await app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: false,
  runFirst: true,
})

app.post('/webhook', { config: { rawBody: true } }, async (request, reply) => {
  const signature = request.headers['stripe-signature']

  if (typeof signature !== 'string') {
    return reply.code(400).send('Missing stripe-signature header')
  }

  const raw = request.rawBody
  if (!(raw instanceof Buffer)) {
    return reply.code(500).send('rawBody was not captured as a Buffer')
  }

  let event

  try {
    // Verify against the exact request body before parsing JSON.
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown verification error'
    return reply.code(400).send(`Webhook signature verification failed: ${message}`)
  }

  const payload = JSON.parse(raw.toString('utf8'))

  request.log.info({ type: event.type, id: payload.id }, 'verified Stripe event')

  return reply.code(200).send('ok')
})

await app.listen({ port: 3000, host: '127.0.0.1' })
