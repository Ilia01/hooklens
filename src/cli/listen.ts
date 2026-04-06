import { Command } from 'commander'

export const listenCommand = new Command('listen')
  .description('Start receiving webhooks')
  .option('-p, --port <port>', 'Port to listen on', '4400')
  .option('--verify <provider>', 'Verify signatures (stripe)')
  .option('--secret <secret>', 'Webhook signing secret')
  .option('--forward-to <url>', 'Forward received webhooks to this URL')
  .action(async (_options) => {
    // TODO: implement
  })
