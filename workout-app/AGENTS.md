# Expo HAS CHANGED

This project is pinned to Expo SDK 54 (downgraded from 57, then 56) because the Apple App Store
build of Expo Go has been stuck in review for SDK 55/56/57 with no timeline; SDK 54 is the newest
version currently supported by the public Expo Go app. Read the exact versioned docs at
https://docs.expo.dev/versions/v54.0.0/ before writing any code, and don't bump the SDK version
without first checking whether Expo Go's App Store build has caught up.

# Backup API

`api/` holds Vercel serverless functions for accounts and sync; `api/README.md`
covers the endpoints, the one-time database setup, and how the conflict model
works. It is Node code, not React Native — check it with `tsconfig.api.json`,
not the root `tsconfig.json`.

The app is offline-first and must stay that way: every screen has to work with
no account, no network, and a server returning `503 not_configured`.
