# Backup & sync API

Serverless functions deployed alongside the web build on Vercel. The app works
entirely offline without them; they exist so a phone's workouts can be backed up
and picked up on another device.

## Endpoints

| Method | Path                 | Purpose |
| ------ | -------------------- | ------- |
| POST   | `/api/auth/register` | Create an account, returns a session token |
| POST   | `/api/auth/login`    | Exchange email + password for a session token |
| POST   | `/api/auth/logout`   | Revoke the caller's token |
| GET    | `/api/me`            | Who the token belongs to, plus the stored revision |
| GET    | `/api/sync`          | Pull the stored snapshot |
| POST   | `/api/sync`          | Push a snapshot, guarded by `baseRevision` |

Anything under `api/_lib/` is shared code. Vercel does not route files whose
name starts with `_`, so those are not reachable as endpoints.

## Setup

1. **Attach a Postgres database.** In the Vercel dashboard, open the
   `workout-app` project → Storage → create or connect a Postgres database
   (Neon works; so does any Postgres you already run). Vercel sets
   `POSTGRES_URL` on the project automatically. If you bring your own, add
   `POSTGRES_URL` (or `DATABASE_URL`) under Settings → Environment Variables
   for Production, Preview and Development.

2. **Create the tables.** Run `api/_lib/schema.sql` against that database once:

   ```
   psql "$POSTGRES_URL" -f api/_lib/schema.sql
   ```

   Every statement is `IF NOT EXISTS`, so re-running it is safe.

3. **Point the phone at the deployment.** The web build calls `/api/...` on its
   own origin and needs no configuration. A native build has no origin, so it
   falls back to the production URL in `src/api/client.ts`. To target a
   different deployment, set `EXPO_PUBLIC_API_URL` before starting Expo:

   ```
   EXPO_PUBLIC_API_URL=https://your-deployment.vercel.app npx expo start
   ```

Until step 1 is done the endpoints return `503 not_configured`, and the app
keeps working offline.

## How sync decides things

The server stores one JSON snapshot per user with a `revision` that increments
on every accepted push. A client sends the revision it last agreed with as
`baseRevision`; if the server has moved past it, the push is rejected with
`409` and the server's copy comes back in the same response.

The client then compares a fingerprint of its current data against the one it
recorded at its last sync:

- server moved, device unchanged → take the server's copy
- device changed, server unchanged → push
- both changed → ask the user which to keep

This is snapshot-level, not per-field. Two devices editing different workouts
between syncs is still a conflict, and resolving it keeps one side whole. For
one person with a phone and a browser that is the honest trade; merging per
entity would need real change tracking on every mutation.

## Local development

Against a local Postgres:

```
psql "postgres://user@127.0.0.1:5432/workout_app" -f api/_lib/schema.sql
npx tsc -p tsconfig.api.json        # builds to .api-build/
```

`tsconfig.api.json` compiles this directory as Node code; the root
`tsconfig.json` is the React Native one and covers the app.
