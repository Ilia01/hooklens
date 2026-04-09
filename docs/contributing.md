# Contributing

This page mirrors the repo's `CONTRIBUTING.md` in a docs-friendly format.

## Getting started

```bash
git clone https://github.com/Ilia01/hooklens.git
cd hooklens
npm install
npm run dev
```

## Making changes

1. Open an issue first if the change is more than a typo fix
2. Fork the repo and branch from `main`
3. Make your changes
4. Run:

```bash
npm test
npm run typecheck
npm run lint
```

5. Open a PR against `main`

## Adding a provider

The verifier seam is intentionally small.

Additions usually touch three places:

1. `src/verify/<provider>.ts`
2. `tests/verify/<provider>.test.ts`
3. `buildVerifier()` in `src/cli/listen.ts`

See [Adding Providers](/verification/adding-providers) for the contract and expectations.

## Security notes

### Local binding only

The server binds to `127.0.0.1`.

HookLens is a local development tool and should not silently become network-reachable.

### Request smuggling defenses

The forwarding path is protected by:

1. Node's HTTP parser rejecting ambiguous framing before user code runs
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
