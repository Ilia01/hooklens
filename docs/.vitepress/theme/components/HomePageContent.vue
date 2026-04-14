<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  terminalLines,
  failureCodes,
  workflowSteps,
  notItems,
  problemGuides,
  feedbackLinks,
} from '../homeData'
import { homepageDocLinks } from '../../sidebar'

const docLinks = homepageDocLinks()

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
    </section>

    <!-- Problem guides -->
    <section class="home-guides" aria-labelledby="home-guides-title">
      <p class="home-section-label">Debugging guides</p>
      <h2 id="home-guides-title">Start from the provider that failed.</h2>
      <div class="home-guides-grid">
        <a
          v-for="guide in problemGuides"
          :key="guide.href"
          class="home-card"
          :href="guide.href"
        >
          <strong class="home-card-title">{{ guide.provider }}</strong>
          <span class="home-card-desc">{{ guide.description }}</span>
        </a>
      </div>
    </section>

    <!-- Doc links (derived from sidebar config) -->
    <section class="home-docs" aria-labelledby="home-docs-title">
      <p class="home-section-label">Documentation</p>
      <h2 id="home-docs-title">Everything else.</h2>
      <div class="home-docs-grid">
        <a v-for="item in docLinks" :key="item.href" class="home-card" :href="item.href">
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
          class="home-card"
          :href="item.href"
        >
          <strong class="home-card-title">{{ item.title }}</strong>
          <span class="home-card-desc">{{ item.description }}</span>
        </a>
      </div>
    </section>
  </div>
</template>
