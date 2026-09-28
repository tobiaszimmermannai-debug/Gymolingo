/**
 * Registers native health adapters. Intentionally empty by default so the app
 * builds everywhere (incl. Expo Go and web). To enable, follow
 * docs/HEALTH_INTEGRATION.md and add e.g.:
 *
 *   import { Platform } from 'react-native';
 *   import { registerHealthProvider } from './index';
 *   import { appleHealthProvider } from './adapters/appleHealth';
 *   import { healthConnectProvider } from './adapters/healthConnect';
 *   if (Platform.OS === 'ios') registerHealthProvider(appleHealthProvider);
 *   if (Platform.OS === 'android') registerHealthProvider(healthConnectProvider);
 */
export {};
