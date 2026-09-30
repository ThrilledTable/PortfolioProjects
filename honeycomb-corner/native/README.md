# Honeycomb Corner as a phone app

This folder turns the web game into an iPhone and Android app using
[Capacitor](https://capacitorjs.com). The game itself is unchanged: Capacitor
wraps the same web page in a native app shell.

## What's already done

- `package.json` lists Capacitor and the **Preferences** plugin.
- `capacitor.config.json` names the app. **Change `appId`** to a reverse domain
  you own (e.g. `com.yourname.honeycombcorner`) before publishing; it can't
  change later.
- `scripts/copy-web.js` copies the game into `www/`, which the app packs.
- Save protection: inside the app, every save is also written to the app's own
  storage (see `store` in `js/util.js`). iOS can clear a web page's storage;
  the app copy brings the save back.

## Steps (need a computer with Node.js)

1. `cd native && npm install`
2. `npx cap add ios` (on a Mac with Xcode) and/or `npx cap add android` (with Android Studio)
3. `npm run ios` or `npm run android`. This copies the latest game in and opens the native project.
4. In Xcode or Android Studio, set the app icon (the files in `../icons/` are a starting point), your team/signing, and press Run.

Run `npm run sync` again whenever the game changes.

## Before submitting to the stores

- Apple Developer account ($99/year) and Google Play Console account ($25 once).
- Privacy details: the game stores its save on the device only. The playtest
  feedback form (`track.js`) should be removed or disclosed in the store build.
- If gems will be sold, use the stores' in-app purchase systems (Apple and
  Google require it for digital items). That means a purchase plugin such as
  RevenueCat's Capacitor SDK. Not added yet; see `docs/GEM-STORE.md`.
- Screenshots: the 240×160 scene scales cleanly; `tools/smoke.js` already saves
  screenshots you can start from.
