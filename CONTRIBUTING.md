# Contributing to HookLens

Thanks for wanting to contribute.

## Getting started

```bash
git clone https://github.com/Ilia01/hooklens.git
cd hooklens
npm install
```

Useful local loops:

- `npm run dev` for CLI/runtime work
- `npm run docs:dev` for docs or homepage work

## Making changes

1. Open an issue first if it's anything beyond a typo fix
2. Fork the repo and create a branch from `main`
3. Make your changes
4. Make sure the relevant checks pass:

```bash
npm test
npm run typecheck
npm run lint
```

If you touched docs, the homepage, or the VitePress theme, also run:

```bash
npm run docs:build
```

5. Open a PR against `main`

## Working in the CLI

Shared defaults live in `src/cli/defaults.ts`.

Shared command wrappers live in `src/cli/runtime.ts`:

- `withDefaultStorage(...)` for commands that open the default SQLite store
- `runCommandAction(...)` for the standard terminal/error wrapper around Commander actions

If you add or refactor commands, reuse those helpers instead of duplicating setup and cleanup logic.

## Working in the docs site

The docs site is a VitePress app.

- homepage content entry point: `docs/index.md`
- custom homepage component: `docs/.vitepress/theme/components/HomePageContent.vue`
- homepage and docs theme styles: `docs/.vitepress/theme/style.css`
- site config and sidebar: `docs/.vitepress/config.ts`

If you change the homepage or theme layer, always run `npm run docs:build` before opening the PR.

## Adding a provider

The server knows nothing about specific providers. It just calls `verify()` on whatever `Verifier` you hand it.

Adding a new one usually touches four places.

### The contract

Every provider implements `Verifier` from `src/types.ts`:

```ts
interface Verifier {
  readonly provider: string
  verify(event: { headers: Record<string, string>; body: string }): VerificationResult
}
```

You get a headers map and the raw body as a string.

You return a `VerificationResult`.

That's the whole seam. Pick your own headers, run whatever crypto you need. HMAC-SHA256, Ed25519, multi-header schemes all fit.

### The steps

**1. Write the verification logic** in `src/verify/<provider>.ts`.

Export a factory that takes provider-specific config and returns a `Verifier`. See `src/verify/stripe.ts` or `src/verify/github.ts` for the reference shape: each exports a verification primitive and a factory.

**2. Write tests** in `tests/verify/<provider>.test.ts`.

If the provider has an official SDK, use it as a test oracle. That way future upstream changes get caught.

**3. Wire it into the CLI**.

Add a case to `buildVerifier` in `src/cli/listen.ts`.

**4. Update the docs**.

If the provider is user-facing, update `docs/verification/adding-providers.md` and the relevant verification index or guide pages so contributors and users can actually discover it.

Server, storage, and forwarding should stay untouched. That's the whole point of the seam.

### Result codes

The `code` field on `VerificationResult` drives the CLI output. Stick to the existing set when you can:

| Code                 | Meaning                                              |
| -------------------- | ---------------------------------------------------- |
| `valid`              | Signature checks out                                 |
| `missing_header`     | Provider's header is not present                     |
| `malformed_header`   | Header is present but not in the expected format     |
| `expired_timestamp`  | Timestamp-based tolerance window exceeded            |
| `signature_mismatch` | Everything parsed but the signature does not match   |
| `body_mutated`       | Would have matched if the body was not re-serialized |

If your provider has a genuinely new failure mode, add it to the enum in `src/types.ts` and update the CLI output.

## Security notes

Things worth knowing if you touch the server or forwarding code.

### Local binding only

The HTTP server binds to `127.0.0.1`. See `src/server/index.ts`.

HookLens is a local dev tool. It must never listen on `0.0.0.0` without a careful review.

### HTTP request smuggling

HookLens sits in front of the user's app and forwards requests. That's exactly the position where smuggling happens when framing headers are mishandled.

The current implementation is safe. Three independent defense layers:

**1. Incoming parse.**
Node's HTTP parser (llhttp) rejects ambiguous framing with a 400 before the request reaches us. This covers `Content-Length` + `Transfer-Encoding` together, malformed chunked encoding, and similar.

**2. Body buffering.**
We read the body via `req.on('data')` / `req.on('end')`. By the time `'end'` fires, Node has dechunked at the parser layer. We hold fully decoded bytes, with no framing ambiguity surviving into our buffer.

**3. Outgoing fetch.**
We forward via `fetch()`. undici computes its own framing from the body we pass. It refuses to let client code set `transfer-encoding` at all.

`headersForForwarding` also strips the RFC 7230 hop-by-hop list as defense in depth. Keep it.

### Body size

We buffer the whole request body in memory and currently cap it at 1 MiB.

This is acceptable because we only listen on `127.0.0.1`. The blast radius is local processes on the same machine.

If anyone ever changes the bind address or the cap, review that carefully first. A larger or unbounded body budget changes the local resource-exhaustion story immediately.

### Forward target

`--forward-to` comes from a CLI flag, not from request data. No SSRF surface.

If a future feature ever lets the forward target come from a webhook payload, validate and allowlist it before using it.

## Commit messages

Use [conventional commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `chore:` maintenance

## Code style

The project uses ESLint and Prettier. Run `npm run lint` and formatting is handled automatically if your editor is set up.
