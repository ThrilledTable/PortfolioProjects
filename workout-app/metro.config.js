// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Some dependencies (e.g. zustand) key their CJS-safe build behind the
// "react-native" export condition, and otherwise fall through to an ESM
// build that references `import.meta`. That breaks when Metro bundles it
// into a plain (non-module) script for the web target, since Expo's web
// platform only activates the "browser" condition by default. Also
// honoring "react-native" for web picks the safe build everywhere.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: [...(config.resolver.unstable_conditionsByPlatform?.web ?? []), 'react-native'],
};

module.exports = config;
