# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # nodemon server.js (auto-reload)
npm start       # node server.js
```

No test framework is configured — `npm test` exits 1 by design. There is no linter or formatter set up either.

## Environment

`.env` is loaded by `dotenv` in `server.js` and again in `src/services/email.service.js`. Required keys:

- `PORT` — port passed to `app.listen`, falling back to `3000` if unset
- `MONGO_URI` — Mongoose connection string; `connectToDB` calls `process.exit(1)` on failure
- `JWT_SECRET` — signing key for auth tokens
- `EMAIL_USER`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN` — Gmail OAuth2 credentials for nodemailer

Note: this directory is not a git repo and has no `.gitignore`, so `.env` is currently unprotected if one is initialized.

## Architecture

CommonJS Node/Express 5 API backed by MongoDB via Mongoose 9. Strict layer separation:

```
server.js            dotenv → connectToDb() → app.listen(PORT)
  src/app.js         express app: json + cookieParser middleware, mounts routers
    src/routes/      thin routers, one per feature, mapped 1:1 to controller fns
      src/controllers/   request/response handling + business logic
        src/models/      Mongoose schemas, hooks, instance methods
        src/services/    external I/O (email)
```

`server.js` only wires things together; `src/app.js` exports the app without listening, so it stays importable for future tests.

### Auth flow (`src/controllers/auth.controller.js`)

Register and login both sign a JWT with payload `{ userId }` and `expiresIn: "3d"`, then return the token **twice**: as a `token` cookie via `res.cookie` and in the JSON response body. Keep both in sync when changing the auth response.

Passwords are hashed by a `pre("save")` hook on the user schema and the `password` field is `select: false`. Any query that needs to verify a password must use `.select("+password")` before calling the `comparePassword` instance method — see `userLoginController`.

### Naming conventions

Files use `<feature>.<layer>.js` (`auth.controller.js`, `user.model.js`, `account.route.js`). Mongoose models are registered with lowercase singular names (`"user"`, `"account"`), which is what `ref:` strings must match.

## Current state / known issues

The account feature is scaffolded but incomplete — treat these as open work, not as patterns to copy:

- `src/routes/account.route.js` is empty and is not mounted in `src/app.js`.
- There is no auth middleware yet; nothing verifies the JWT on incoming requests.
- `src/models/account.model.js`: the `status` field declares an `enum` but no `type: String`, so Mongoose does not treat it as a string enum path. It also has no `default`.
- `src/models/user.model.js`: the `pre("save")` hook is an async function that calls `next()` without declaring `next` — this throws a `ReferenceError` whenever a document is saved without a modified password.
- `userLoginController` returns placeholder error strings (`"Email or Password is inValid 1"` / `"... ggg"`).
- Controllers have no try/catch; a rejected promise (duplicate key, validation error) becomes an unhandled rejection since there is no Express error handler.
- `userRegisterController` awaits `sendRegistrationEmail` *after* sending the response, so email failures are invisible to the client.
