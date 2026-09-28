// Optional base path for hosting the web app in a sub-folder,
// e.g. GitHub Pages: EXPO_BASE_URL=/Gymolingo → https://<user>.github.io/Gymolingo/
module.exports = ({ config }) =>
  process.env.EXPO_BASE_URL ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL } } : config;
