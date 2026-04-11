# Contributing

This page mirrors the repo's `CONTRIBUTING.md` in a docs-friendly format.

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

1. Open an issue first if the change is more than a typo fix
2. Fork the repo and branch from `main`
3. Make your changes
4. Run the core checks:

```bash
npm test
npm run typecheck
npm run lint
```

If you changed docs, the homepage, or the VitePress theme, also run:

```bash
npm run docs:build
```

5. Open a PR against `main`

## Working in the CLI

CLI defaults live in `src/cli/defaults.ts`.

Shared command wrappers live in `src/cli/runtime.ts`:

- `withDefaultStorage(...)` for commands that open the default SQLite database
- `runCommandAction(...)` for the standard terminal/error wrapper around Commander actions

Reuse those helpers instead of duplicating setup and cleanup logic in each command.

## Working in the docs site

The docs site now has a custom homepage/theme layer:

- homepage entry point: `docs/index.md`
- custom homepage component: `docs/.vitepress/theme/components/HomePageContent.vue`
- shared theme styles: `docs/.vitepress/theme/style.css`
- site config and sidebar: `docs/.vitepress/config.ts`

If you touch that layer, make `npm run docs:build` part of your normal loop.

## Adding a provider

The verifier seam is intentionally small.

Additions usually touch four places:

1. `src/verify/<provider>.ts`
2. `tests/verify/<provider>.test.ts`
3. `buildVerifier()` in `src/cli/listen.ts`
4. the relevant docs pages under `docs/verification/`

See [Adding Providers](/verification/adding-providers) for the contract and expectations.

## Security notes

### Local binding only

The server binds to `127.0.0.1`.

HookLens is a local development tool and should not silently become network-reachable.

### Request smuggling defenses

The forwarding path is protected by:

1. Node's default HTTP parser rejecting ambiguous framing before user code runs
2. full request-body buffering after parser-level dechunking
3. `fetch()` recomputing outgoing framing

HookLens also strips hop-by-hop forwarding headers as defense in depth.

### Body size

HookLens buffers the full request body in memory and currently caps it at 1 MiB. That is acceptable because the server only listens on localhost.

### Forward target trust

`--forward-to` is provided by the CLI user, not by webhook data. If a future feature ever derives the target from request content, that will need explicit validation and allowlisting.

## Commit messages

Use conventional commits:

- `feat:`
- `fix:`
- `docs:`
- `test:`
- `chore:`

## Code style

The repo uses ESLint and Prettier. Run `npm run lint` before you open a PR.
