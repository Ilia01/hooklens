import { defineConfig } from 'vitepress'
import { sidebar } from './sidebar'

export default defineConfig({
  title: 'HookLens',
  description:
    'CLI tool that captures webhook requests before your app parses them, verifies signatures locally, and replays stored events for debugging.',
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
      { text: 'Feedback', link: 'https://github.com/Ilia01/hooklens/issues/new/choose' },
    ],
    sidebar,
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
