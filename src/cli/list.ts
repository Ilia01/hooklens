import { Command } from 'commander'

export const listCommand = new Command('list')
  .description('Show received webhook events')
  .option('-n, --limit <count>', 'Number of events to show', '20')
  .action(async (_options) => {
    // TODO: implement
  })
