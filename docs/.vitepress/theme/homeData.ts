// Homepage content lives here so HomePageContent.vue stays pure layout.
// When adding a provider, command, or failure code, edit this file.

const GITHUB_ISSUES_NEW_BASE = 'https://github.com/Ilia01/hooklens/issues/new'

export const terminalLines = [
  { text: '$ hooklens listen --port 4400 --verify github --secret ghsecret_xxx', type: 'input' },
  { text: '', type: 'blank' },
  { text: 'Listening on http://127.0.0.1:4400', type: 'info' },
  { text: 'Verifier: github', type: 'dim' },
  { text: 'Forwarding to: disabled', type: 'dim' },
  { text: 'Storage: ~/.hooklens/events.db', type: 'dim' },
  { text: '', type: 'blank' },
  { text: 'RECV evt_sc-h1t8xq POST /webhook', type: 'recv' },
  { text: 'PASS evt_a2-kp93z POST /webhook signature valid', type: 'pass' },
  {
    text: 'FAIL evt_r7-vm20d POST /webhook signature_mismatch - check secret or raw body',
    type: 'fail',
  },
] as const

export const failureCodes = [
  { code: 'missing_header', description: 'The expected signature header was not in the request.' },
  {
    code: 'malformed_header',
    description: 'The header was present but did not match the expected format.',
  },
  {
    code: 'expired_timestamp',
    description: 'The timestamp in the signature fell outside the tolerance window.',
  },
  {
    code: 'signature_mismatch',
    description: 'The header parsed correctly but the computed digest did not match.',
  },
  {
    code: 'body_mutated',
    description:
      'The secret is likely correct, but middleware parsed and re-serialized the body bytes.',
  },
] as const

export const workflowSteps = [
  {
    index: '01',
    title: 'Listen',
    description: 'Start a local server that captures and optionally verifies incoming webhooks.',
    command: 'hooklens listen',
  },
  {
    index: '02',
    title: 'Inspect',
    description: 'View the stored event: headers, body, and the specific failure code.',
    command: 'hooklens inspect <id>',
  },
  {
    index: '03',
    title: 'Replay',
    description: 'Resend the same method, headers, and body to your app after fixing the issue.',
    command: 'hooklens replay <id>',
  },
] as const

export const notItems = [
  'Not a tunnel. Use ngrok, Cloudflare Tunnel, or your provider CLI.',
  'Not a hosted webhook inbox. Events are stored locally in SQLite.',
  'Not a replacement for Stripe CLI or GitHub delivery tools.',
] as const

export const problemGuides = [
  {
    provider: 'Stripe',
    href: './verification/stripe-signature-failures',
    description: 'Wrong secret, expired timestamps, missing headers, body mutation.',
  },
  {
    provider: 'GitHub',
    href: './verification/github-signature-mismatch',
    description: 'Bad x-hub-signature-256, wrong secret, raw body handling.',
  },
  {
    provider: 'Raw body',
    href: './verification/raw-body-mutation',
    description: 'Why JSON parsing and re-serialization break signed payloads.',
  },
] as const

export const feedbackLinks = [
  {
    href: `${GITHUB_ISSUES_NEW_BASE}?template=user_feedback.yml`,
    title: 'User feedback',
    description: 'Tell me what you were debugging, where HookLens helped, and where it broke down.',
  },
  {
    href: `${GITHUB_ISSUES_NEW_BASE}?template=bug_report.yml`,
    title: 'Bug report',
    description: 'Use this when the CLI, replay path, docs, or output is actually wrong.',
  },
  {
    href: `${GITHUB_ISSUES_NEW_BASE}?template=feature_request.yml`,
    title: 'Feature request',
    description:
      'Missing provider, missing command behavior, or a workflow HookLens should support.',
  },
] as const
