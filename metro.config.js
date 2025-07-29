const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure widgets and related modules are properly resolved
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add widget-related file extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'tsx', 'ts'];

// Ensure proper module resolution for widgets
config.resolver.alias = {
  ...config.resolver.alias,
  '@widgets': './components/widgets',
  '@lib': './lib',
};

module.exports = config;
