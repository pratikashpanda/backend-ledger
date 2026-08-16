# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # nodemon server.js (auto-reload)
npm start       # node server.js
```

No test framework is configured — `npm test` exits 1 by design. There is no linter or formatter set up either.

## Git workflow

Trunk-based development against `main`, which stays deployable at all times. **Never commit directly to `main`.**

Every change — including one-line fixes — follows this loop:

```bash
git checkout main && git pull                 # start from current trunk
git checkout -b feat/transaction-transfer     # one branch per unit of work
# ... commit as you go ...
git push -u origin feat/transaction-transfer
gh pr create --fill                           # or the URL git prints on push
# review, then SQUASH MERGE on GitHub
git checkout main && git pull
git branch -d feat/transaction-transfer
git push origin --delete feat/transaction-transfer
```

**Squash merge is the required merge strategy** — one PR becomes exactly one commit on `main`. This keeps history linear, so `git bisect` and reverting a whole feature stay trivial. Do not use merge commits or rebase-merge. (PR #1 predates this rule and landed as a merge commit.)

Branch prefixes: `feat/` `fix/` `chore/` `docs/` `refactor/`. Branches are short-lived — hours to a couple of days, never weeks.

Commit subjects use Conventional Commits (`feat:`, `fix:`, `chore:`) so changelog automation stays possible later.

`gh` is installed and authenticated, so PRs can be opened from the CLI. The token lacks the `workflow` scope — run `gh auth refresh -s workflow` before pushing anything under `.github/workflows/`.

## Environment

`.env` is loaded by `dotenv` in `server.js` and again in `src/services/email.service.js`. Required keys:

- `PORT` — port passed to `app.listen`, falling back to `3000` if unset
- `MONGO_URI` — Mongoose connection string; `connectToDB` calls `process.exit(1)` on failure
- `JWT_SECRET` — signing key for auth tokens
- `EMAIL_USER`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN` — Gmail OAuth2 credentials for nodemailer

`.env` is gitignored; `.env.example` tracks the key names and must be updated whenever a new variable is introduced.

## Architecture

CommonJS Node/Express 5 API backed by MongoDB via Mongoose 9. Strict layer separation:

```
server.js            dotenv → connectToDb() → app.listen(PORT)
  src/app.js         express app: json + cookieParser middleware, mounts routers
    src/routes/      thin routers, one per feature, mapped 1:1 to controller fns
      src/middleware/    cross-cutting request guards (authMiddleware)
      src/controllers/   request/response handling + business logic
        src/models/      Mongoose schemas, hooks, instance methods
        src/services/    external I/O (email)
```

`server.js` only wires things together; `src/app.js` exports the app without listening, so it stays importable for future tests.

### Auth flow (`src/controllers/auth.controller.js`)

Register and login both sign a JWT with payload `{ userId }` and `expiresIn: "3d"`, then return the token **twice**: as a `token` cookie via `res.cookie` and in the JSON response body. Keep both in sync when changing the auth response.

Passwords are hashed by a `pre("save")` hook on the user schema and the `password` field is `select: false`. Any query that needs to verify a password must use `.select("+password")` before calling the `comparePassword` instance method — see `userLoginController`.

Protected routes sit behind `authMiddleware` (`src/middleware/auth.middleware.js`), which accepts the JWT from either the `token` cookie or an `Authorization: Bearer` header, loads the user, and attaches it as `req.user`. Downstream controllers read the owner from `req.user._id` rather than trusting anything in the request body.

Mongoose `pre` hooks in this codebase are `async` functions with **no `next` parameter** — the chain advances when the returned promise settles, and an early `return` skips the work. Do not call `next()` in them.

### Naming conventions

Files use `<feature>.<layer>.js` (`auth.controller.js`, `user.model.js`, `account.route.js`). Mongoose models are registered with lowercase singular names (`"user"`, `"account"`, `"transaction"`), which is what `ref:` strings must match.

### API documentation

Endpoints are documented with JSDoc (`/** … */`) on the **controller function**, covering method, path, request body, and every status code; route files carry a short block with an `@see` link to the controller. Bodies render as markdown on hover. `req`/`res` are typed via `@param {import("express").Request}` — `@types/express` and `jsconfig.json` exist solely to make that resolve. Keep new endpoints consistent with this.

## Current state / known issues

Auth and account creation work end to end. Open work — treat these as known gaps, not patterns to copy:

- **No error handling.** Controllers have no try/catch and there is no Express error-handling middleware, so a rejected promise (duplicate key, validation failure) becomes an unhandled rejection.
- **`transaction.model.js` has no controller or route yet.** The schema is in place — double-entry `fromAccount`/`toAccount` refs, status enum, unique `idempotencyKey` — but nothing writes to it. Transfers must be wrapped in a Mongoose session/transaction to keep both sides atomic.
- **`createAccountController` ignores `req.body`.** It creates the account solely from `req.user._id`, so `currency` cannot be chosen by the caller and always falls back to the schema default `"INR"`.
- **`account.model.js`: `status` has no `default`,** so accounts are created with `status: undefined`, which makes the `{ user: 1, status: 1 }` compound index useless. `default: "ACTIVE"` is probably intended.
- **Placeholder error strings** in `userLoginController` (`"Email or Password is inValid 1"` / `"... ggg"`).
- **`userRegisterController` sends the welcome email after responding,** so mail failures are invisible to the client — deliberate, but it means failures are silent.
- **No tests.** `npm test` exits 1, so there is no CI gate to protect `main` with yet.
