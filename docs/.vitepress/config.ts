import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'HookLens',
  description:
    'CLI tool that captures raw webhook requests, verifies signatures locally, and replays stored events for debugging.',
  base: '/hooklens/',
  appearance: 'dark',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/hooklens/logo.svg' }]],
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Commands', link: '/commands/' },
      { text: 'Verification', link: '/verification/' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Forwarding', link: '/forwarding' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Contributing', link: '/contributing' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
      {
        text: 'Commands',
        items: [
          { text: 'Overview', link: '/commands/' },
          { text: 'listen', link: '/commands/listen' },
          { text: 'list', link: '/commands/list' },
          { text: 'inspect', link: '/commands/inspect' },
          { text: 'replay', link: '/commands/replay' },
          { text: 'delete', link: '/commands/delete' },
          { text: 'clear', link: '/commands/clear' },
        ],
      },
      {
        text: 'Verification',
        items: [
          { text: 'Overview', link: '/verification/' },
          { text: 'Stripe Failures', link: '/verification/stripe-signature-failures' },
          { text: 'GitHub Mismatch', link: '/verification/github-signature-mismatch' },
          { text: 'Raw Body Mutation', link: '/verification/raw-body-mutation' },
          { text: 'Adding Providers', link: '/verification/adding-providers' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Ilia01/hooklens' }],
    editLink: {
      pattern: 'https://github.com/Ilia01/hooklens/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Ilia Goginashvili',
    },
    search: {
      provider: 'local',
    },
  },
})
