import express from 'express'
import Stripe from 'stripe'

const app = express()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder')
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

if (!webhookSecret) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET')
}

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.get('stripe-signature')

  if (!signature) {
    res.status(400).send('Missing stripe-signature header')
    return
  }

  let event

  try {
    // Verify against the exact request body before parsing JSON.
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown verification error'
    res.status(400).send(`Webhook signature verification failed: ${message}`)
    return
  }

  const payload = JSON.parse(req.body.toString('utf8'))

  console.log('verified event type:', event.type)
  console.log('payload id:', payload.id)

  res.status(200).send('ok')
})

app.listen(3000, () => {
  console.log('Express example listening on http://localhost:3000')
})
