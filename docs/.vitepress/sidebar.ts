// Single source of truth for the sidebar structure.
// config.ts uses this directly. The homepage derives doc links from it.

export interface SidebarItem {
  text: string
  link: string
  description?: string
}

export interface SidebarGroup {
  text: string
  items: SidebarItem[]
}

export const sidebar: SidebarGroup[] = [
  {
    text: 'Guide',
    items: [
      {
        text: 'Getting Started',
        link: '/getting-started',
        description: 'Install and capture your first event.',
      },
      {
        text: 'Forwarding',
        link: '/forwarding',
        description: 'Forward captured events to your local app.',
      },
      {
        text: 'Architecture',
        link: '/architecture',
        description: 'Storage, verifier interface, and server model.',
      },
      {
        text: 'Adding Providers',
        link: '/verification/adding-providers',
      },
      {
        text: 'Contributing',
        link: '/contributing',
        description: 'Setup, workflow, and adding new providers.',
      },
      { text: 'Changelog', link: '/changelog' },
    ],
  },
  {
    text: 'Commands',
    items: [
      {
        text: 'CLI Overview',
        link: '/commands/',
        description: 'listen, list, inspect, replay, delete, clear.',
      },
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
      {
        text: 'Verification Overview',
        link: '/verification/',
        description: 'Failure codes and provider-specific behavior.',
      },
      {
        text: 'Stripe Signature Failures',
        link: '/verification/stripe-signature-failures',
      },
      {
        text: 'GitHub Signature Mismatch',
        link: '/verification/github-signature-mismatch',
      },
      {
        text: 'Raw Body Mutation',
        link: '/verification/raw-body-mutation',
      },
    ],
  },
]

// Items with a description are promoted to the homepage doc links grid.
// This keeps the homepage in sync with the sidebar automatically.
export function homepageDocLinks(): { href: string; title: string; description: string }[] {
  const links: { href: string; title: string; description: string }[] = []
  for (const group of sidebar) {
    for (const item of group.items) {
      if (item.description) {
        links.push({
          href: '.' + item.link,
          title: item.text,
          description: item.description,
        })
      }
    }
  }
  return links
}
