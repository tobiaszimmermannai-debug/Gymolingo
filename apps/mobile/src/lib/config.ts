/**
 * Feature switches.
 * AI (Google Gemini, free tier) is visible by default but only works after a tester
 * pastes their own free key in Settings → KI – without a key everything runs
 * rule-based on the device. Set EXPO_PUBLIC_AI_ENABLED=false to hide AI entirely.
 */
export const AI_ENABLED = process.env.EXPO_PUBLIC_AI_ENABLED !== 'false';
