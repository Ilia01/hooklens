<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const terminalLines = [
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
    text: 'FAIL evt_r7-vm20d POST /webhook signature_mismatch — check secret or raw body',
    type: 'fail',
  },
] as const

const failureCodes = [
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

const workflowSteps = [
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

const notItems = [
  'Not a tunnel. Use ngrok, Cloudflare Tunnel, or your provider CLI.',
  'Not a hosted webhook inbox. Events are stored locally in SQLite.',
  'Not a replacement for Stripe CLI or GitHub delivery tools.',
] as const

const docLinks = [
  {
    href: './getting-started',
    title: 'Getting Started',
    description: 'Install and capture your first event.',
  },
  {
    href: './commands/',
    title: 'Commands',
    description: 'listen, list, inspect, replay, delete, clear.',
  },
  {
    href: './verification/',
    title: 'Verification',
    description: 'Failure codes and provider-specific behavior.',
  },
  {
    href: './forwarding',
    title: 'Forwarding',
    description: 'Forward captured events to your local app.',
  },
  {
    href: './architecture',
    title: 'Architecture',
    description: 'Storage, verifier interface, and server model.',
  },
  {
    href: './contributing',
    title: 'Contributing',
    description: 'Setup, workflow, and adding new providers.',
  },
] as const

const feedbackLinks = [
  {
    href: 'https://github.com/Ilia01/hooklens/issues/new?template=user_feedback.yml',
    title: 'User feedback',
    description: 'Tell me what you were debugging, where HookLens helped, and where it broke down.',
  },
  {
    href: 'https://github.com/Ilia01/hooklens/issues/new?template=bug_report.yml',
    title: 'Bug report',
    description: 'Use this when the CLI, replay path, docs, or output is actually wrong.',
  },
  {
    href: 'https://github.com/Ilia01/hooklens/issues/new?template=feature_request.yml',
    title: 'Feature request',
    description: 'Missing provider, missing command behavior, or a workflow HookLens should support.',
  },
] as const

const problemGuides = [
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

const visibleLines = ref(0)
let intervalId: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  let i = 0
  intervalId = setInterval(() => {
    i++
    visibleLines.value = i
    if (i >= terminalLines.length && intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }, 180)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
})
</script>

<template>
  <div>
    <!-- Terminal demo -->
    <section class="home-terminal-section" aria-labelledby="home-terminal-title">
      <h2 id="home-terminal-title" class="sr-only">Terminal demo</h2>
      <div class="home-terminal">
        <div class="home-terminal-chrome">
          <span class="home-terminal-dot"></span>
          <span class="home-terminal-dot"></span>
          <span class="home-terminal-dot"></span>
          <span class="home-terminal-title-text">hooklens</span>
        </div>
        <div class="home-terminal-body">
          <template v-for="(line, idx) in terminalLines" :key="idx">
            <span v-if="idx < visibleLines" :class="['home-tl', 'home-tl--' + line.type]">{{
              line.text
            }}</span>
          </template>
          <span class="home-terminal-cursor" />
        </div>
      </div>
    </section>

    <!-- Failure codes -->
    <section class="home-codes" aria-labelledby="home-codes-title">
      <div class="home-codes-header">
        <p class="home-section-label">Failure codes</p>
        <h2 id="home-codes-title">What the output actually means.</h2>
        <p>
          Instead of a generic &ldquo;invalid signature&rdquo; error, HookLens returns one of these
          codes so you know where to look.
        </p>
      </div>
      <div class="home-codes-list">
        <div v-for="item in failureCodes" :key="item.code" class="home-codes-row">
          <code>{{ item.code }}</code>
          <span>{{ item.description }}</span>
        </div>
      </div>
    </section>

    <!-- Workflow -->
    <section class="home-workflow" aria-labelledby="home-workflow-title">
      <p class="home-section-label">How it works</p>
      <h2 id="home-workflow-title">Three commands. That's the whole loop.</h2>
      <div class="home-workflow-grid">
        <article v-for="step in workflowSteps" :key="step.index" class="home-workflow-step">
          <span class="home-workflow-index">{{ step.index }}</span>
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
          <code>{{ step.command }}</code>
        </article>
      </div>
    </section>

    <!-- What it is not -->
    <section class="home-not" aria-labelledby="home-not-title">
      <p class="home-section-label">Scope</p>
      <div class="home-not-inner">
        <div class="home-not-copy">
          <h2 id="home-not-title">What HookLens is not.</h2>
          <p>
            HookLens handles local verification debugging after the webhook reaches your machine.
            Everything before that is someone else's job.
          </p>
        </div>
        <ul class="home-not-list">
          <li v-for="item in notItems" :key="item">{{ item }}</li>
        </ul>
      </div>
    </section>

    <!-- Problem guides -->
    <section class="home-guides" aria-labelledby="home-guides-title">
      <p class="home-section-label">Debugging guides</p>
      <h2 id="home-guides-title">Start from the provider that failed.</h2>
      <div class="home-guides-grid">
        <a
          v-for="guide in problemGuides"
          :key="guide.href"
          class="home-guide-card"
          :href="guide.href"
        >
          <strong class="home-card-title">{{ guide.provider }}</strong>
          <span class="home-card-desc">{{ guide.description }}</span>
        </a>
      </div>
    </section>

    <!-- Doc links -->
    <section class="home-docs" aria-labelledby="home-docs-title">
      <p class="home-section-label">Documentation</p>
      <h2 id="home-docs-title">Everything else.</h2>
      <div class="home-docs-grid">
        <a v-for="item in docLinks" :key="item.href" class="home-doc-card" :href="item.href">
          <strong class="home-card-title">{{ item.title }}</strong>
          <span class="home-card-desc">{{ item.description }}</span>
        </a>
      </div>
    </section>

    <section class="home-feedback" aria-labelledby="home-feedback-title">
      <p class="home-section-label">Feedback</p>
      <h2 id="home-feedback-title">Tell me where HookLens failed you.</h2>
      <p class="home-feedback-copy">
        The useful reports are not generic. Tell me the provider, framework, exact failure, and
        what you expected HookLens to show or do instead.
      </p>
      <div class="home-feedback-grid">
        <a
          v-for="item in feedbackLinks"
          :key="item.href"
          class="home-feedback-card"
          :href="item.href"
        >
          <strong class="home-card-title">{{ item.title }}</strong>
          <span class="home-card-desc">{{ item.description }}</span>
        </a>
      </div>
    </section>
  </div>
</template>
