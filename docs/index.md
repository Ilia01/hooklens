---
layout: home

hero:
  name: HookLens
  text: Inspect, verify, and replay webhooks
  tagline: Figure out why webhook signature verification failed before your framework hides the evidence.
  image:
    src: /logo.svg
    alt: HookLens
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started
    - theme: alt
      text: Commands
      link: /commands/
    - theme: alt
      text: GitHub
      link: https://github.com/Ilia01/hooklens
---

<div class="home-demo">
  <p class="home-demo-copy">
    HookLens sits between the webhook provider and your app. It captures the request, verifies it, stores it locally, and can forward or replay it later.
  </p>
  <div class="home-demo-frame">
    <img
      src="/hooklens-demo.gif"
      alt="HookLens demo showing listen, list, and replay across two terminal panes with failing and successful GitHub webhook verification."
    />
  </div>
</div>

<div class="home-feature-grid">
  <div class="home-feature-card">
    <h2>Capture the raw request</h2>
    <p>HookLens listens on node:http directly, stores the original request body, and keeps the request shape intact for replay and inspection.</p>
  </div>
  <div class="home-feature-card">
    <h2>Diagnose signature failures</h2>
    <p>Stripe and GitHub verification report specific failure codes like missing header, malformed header, expired timestamp, body mutation, and signature mismatch.</p>
  </div>
  <div class="home-feature-card">
    <h2>Replay without guesswork</h2>
    <p>Stored events can be replayed to a new target after you change middleware, secrets, or handler logic. Forwarding preserves trusted target origin and base path behavior.</p>
  </div>
</div>

<div class="home-providers">
  <p class="home-providers-label">Current provider support</p>
  <div class="home-providers-list">
    <span class="provider-badge provider-stripe">Stripe</span>
    <span class="provider-badge provider-github">GitHub</span>
  </div>
</div>

<div class="home-cta">

Start with [Getting Started](./getting-started) for the first capture flow, or jump to [Commands](./commands/) for the full CLI reference. More providers can be added without changing the server or storage layers the verifier seam is documented in [Adding Providers](./verification/adding-providers).

</div>
