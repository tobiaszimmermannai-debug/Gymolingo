/**
 * Feature switches. Everything defaults to the zero-cost configuration:
 * - AI (Anthropic API) is OFF → the coach and weekly report run fully on-device
 *   (rule-based, computed from your own data). Enabling AI is a deliberate,
 *   paid opt-in: set EXPO_PUBLIC_AI_ENABLED=true AND the ANTHROPIC_API_KEY secret.
 */
export const AI_ENABLED = process.env.EXPO_PUBLIC_AI_ENABLED === 'true';
