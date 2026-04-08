import { Command } from 'commander'
import type { Verifier } from '../types.js'
import { createStripeVerifier } from '../verify/stripe.js'

export interface ListenFlags {
  verify?: string
  secret?: string
}

/** Maps --verify flags to a Verifier. See CONTRIBUTING.md → Adding a provider. */
export function buildVerifier(flags: ListenFlags): Verifier | undefined {
  if (!flags.verify) return undefined

  switch (flags.verify) {
    case 'stripe': {
      if (!flags.secret) {
        throw new Error('--secret is required when --verify stripe is set')
      }
      return createStripeVerifier({ secret: flags.secret })
    }
    default:
      throw new Error(`Unknown --verify provider "${flags.verify}". Supported: stripe`)
  }
}

export const listenCommand = new Command('listen')
  .description('Start receiving webhooks')
  .option('-p, --port <port>', 'Port to listen on', '4400')
  .option('--verify <provider>', 'Verify signatures (stripe)')
  .option('--secret <secret>', 'Webhook signing secret')
  .option('--forward-to <url>', 'Forward received webhooks to this URL')
  .action(async (_options) => {
    // TODO: implement
    // const verifier = buildVerifier(_options)
    // const storage = createStorage(...)
    // const server = createServer({ port, storage, verifier, forwardTo })
    // await server.start()
  })
