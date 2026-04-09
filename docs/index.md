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
    <h2>Capture raw requests</h2>
    <p>Store the exact payload, headers, and path for later inspection.</p>
  </div>
  <div class="home-feature-card">
    <h2>Explain verification failures</h2>
    <p>Get specific failure reasons instead of a generic signature mismatch.</p>
  </div>
  <div class="home-feature-card">
    <h2>Replay safely</h2>
    <p>Resend stored events to a new target after changing your app setup.</p>
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
