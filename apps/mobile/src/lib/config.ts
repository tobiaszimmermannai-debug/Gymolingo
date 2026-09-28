/**
 * Feature switches. Everything defaults to the zero-cost configuration:
 * - AI (Google Gemini) is OFF → the coach and weekly report run fully on-device
 *   (rule-based, computed from your own data). Enabling AI is a deliberate opt-in:
 *   set EXPO_PUBLIC_AI_ENABLED=true AND the GEMINI_API_KEY secret on Supabase.
 */
export const AI_ENABLED = process.env.EXPO_PUBLIC_AI_ENABLED === 'true';
