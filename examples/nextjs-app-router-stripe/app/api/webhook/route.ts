import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder')
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

if (!webhookSecret) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET')
}

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const rawBody = await req.text()

  let event

  try {
    // Verify against the exact request body before parsing JSON.
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown verification error'
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  const payload = JSON.parse(rawBody)

  console.log('verified event type:', event.type)
  console.log('payload id:', payload.id)

  return new Response('ok', { status: 200 })
}
