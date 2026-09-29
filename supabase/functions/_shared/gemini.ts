/**
 * Server configuration for the shared Gemini client (packages/core/src/ai).
 * Keys: the user's own key (userKey.ts) or an optional shared GEMINI_API_KEY secret.
 */
import { describeGeminiError, GEMINI_TEXT_MODEL, GEMINI_VISION_MODEL, geminiValidateKey } from './core.mjs';

export const MODEL: string = Deno.env.get('GEMINI_MODEL') ?? GEMINI_TEXT_MODEL;
export const VISION_MODEL: string = Deno.env.get('GEMINI_VISION_MODEL') ?? GEMINI_VISION_MODEL;
export const geminiConfig = { base: Deno.env.get('GEMINI_API_BASE') ?? undefined, textModel: MODEL, visionModel: VISION_MODEL };

export function geminiKey(): string | null {
  return Deno.env.get('GEMINI_API_KEY') || null;
}

export const validateKey = (key: string): Promise<'ok' | 'invalid' | 'unavailable'> => geminiValidateKey(key, geminiConfig);
export const describeError = (e: unknown): { status: number; message: string } => describeGeminiError(e);
