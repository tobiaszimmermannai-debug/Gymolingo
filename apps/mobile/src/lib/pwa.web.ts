/** Registers the offline service worker in production web builds (public/sw.js). */
export function registerServiceWorker() {
  if (__DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, ''); // e.g. "/Gymolingo" on GitHub Pages
  const register = () => navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => undefined);
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
