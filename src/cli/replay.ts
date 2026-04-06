import { Command } from 'commander'

export const replayCommand = new Command('replay')
  .description('Replay a stored webhook event')
  .argument('<event-id>', 'ID of the event to replay')
  .option('--to <url>', 'Target URL to send the event to', 'http://localhost:3000/webhook')
  .action(async (_eventId, _options) => {
    // TODO: implement
  })
