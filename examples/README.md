# Examples

These examples show the fixed shape for webhook handling with HookLens:

- preserve the exact request body first
- verify the signature against that exact body
- parse JSON only after verification succeeds

Each example uses Stripe because it is the most common raw-body failure path, but
the same rule applies to GitHub and other signed webhook providers.

## Included examples

- [Express + Stripe](./express-stripe/README.md)
- [Fastify + Stripe](./fastify-stripe/README.md)
- [Next.js App Router + Stripe](./nextjs-app-router-stripe/README.md)

## The HookLens loop

In all of these examples, the flow is the same:

1. Start your local app on `localhost:3000`.
2. Start HookLens in front of it:

   ```bash
   hooklens listen \
     --port 4400 \
     --verify stripe \
     --secret "$STRIPE_WEBHOOK_SECRET" \
     --forward-to http://localhost:3000
   ```

3. Point Stripe CLI at HookLens instead of your app directly:
   - for `POST /webhook` routes:

     ```bash
     stripe listen --forward-to http://127.0.0.1:4400/webhook
     ```

   - for Next.js `POST /api/webhook` routes:

     ```bash
     stripe listen --forward-to http://127.0.0.1:4400/api/webhook
     ```

4. Trigger a test event:

   ```bash
   stripe trigger checkout.session.completed
   ```

5. If verification fails, use:

   ```bash
   hooklens list
   hooklens inspect <event-id>
   hooklens replay <event-id> --to http://localhost:3000
   ```

## Notes

- These are intentionally minimal examples, not production scaffolds.
- They focus on the request-body handling shape that usually causes signature verification failures.
- If your stack parses the body before verification, fix that first. Everything after that is noise.
