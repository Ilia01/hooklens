# Contributing to HookLens

Thanks for wanting to contribute.

## Getting started

```bash
git clone https://github.com/Ilia01/hooklens.git
cd hooklens
npm install
npm run dev
```

## Making changes

1. Open an issue first if it's anything beyond a typo fix
2. Fork the repo and create a branch from `main`
3. Make your changes
4. Make sure checks pass:

```bash
npm test
npm run typecheck
npm run lint
```

5. Open a PR against `main`

## Adding a provider

Provider verification modules live in `src/verify/`. Each one exports a function that takes a raw body buffer and headers, and returns a verification result with a human-readable message on failure.

Look at `src/verify/stripe.ts` as a reference.

## Commit messages

Use [conventional commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `chore:` maintenance

## Code style

The project uses ESLint and Prettier. Run `npm run lint` and formatting is handled automatically if your editor is set up.
