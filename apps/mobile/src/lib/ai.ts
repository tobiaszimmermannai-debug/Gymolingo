/**
 * Client for the server-side AI functions (Supabase Edge Functions).
 * API keys never reach the app – the functions hold GEMINI_API_KEY (Google Gemini).
 */
import { supabase } from './supabase';
import { useDB } from '@/data/store';
import { AI_ENABLED } from './config';

export type AiAvailability = 'ok' | 'disabled' | 'no_backend' | 'no_account';

export function aiAvailability(): AiAvailability {
  if (!AI_ENABLED) return 'disabled';
  if (!supabase) return 'no_backend';
  if (!useDB.getState().accountUserId) return 'no_account';
  return 'ok';
}

export class AiError extends Error {
  constructor(message: string, public code: 'not_configured' | 'unavailable' | 'rate_limited' | 'failed') {
    super(message);
  }
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new AiError('Kein Backend konfiguriert', 'unavailable');
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let payload: { error?: string; code?: string } | null = null;
    try {
      payload = ctx ? await ctx.json() : null;
    } catch {
      payload = null;
    }
    if (payload?.code === 'not_configured') throw new AiError(payload.error ?? 'KI ist auf dem Server nicht konfiguriert.', 'not_configured');
    if (ctx?.status === 429) throw new AiError('Zu viele Anfragen – bitte kurz warten.', 'rate_limited');
    throw new AiError(payload?.error ?? error.message ?? 'KI-Anfrage fehlgeschlagen', 'failed');
  }
  return data as T;
}

export interface CoachReply {
  reply: string;
  source: 'ai' | 'rules';
  model?: string;
}

export function askCoach(message: string, history: { role: 'user' | 'assistant'; content: string }[], today: string) {
  return invoke<CoachReply>('coach', { action: 'chat', message, history: history.slice(-10), today });
}

export interface AiWeeklyReport {
  sections: { heading: string; body: string }[];
  stats: unknown;
  source: 'ai' | 'rules';
  model?: string;
}

export function aiWeeklyReport(weekStart: string, today: string) {
  return invoke<AiWeeklyReport>('coach', { action: 'weekly_report', weekStart, today });
}

export interface PhotoEstimateItem {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'low' | 'medium' | 'high';
}

export function analyzeMealPhoto(imageBase64: string, mediaType: string, hint?: string) {
  return invoke<{ items: PhotoEstimateItem[]; note: string; model: string }>('meal-photo', { image: imageBase64, mediaType, hint });
}

export interface BodyFatEstimate {
  usable: boolean;
  body_fat_pct?: number;
  range_low?: number;
  range_high?: number;
  confidence?: 'low' | 'medium' | 'high';
  cues: string;
  photo_tips?: string;
  model?: string;
}

/** Visual body fat estimate from 1–3 progress photos (downscaled JPEGs, base64). */
export function estimateBodyFat(images: { data: string; mediaType: string; pose: string }[]) {
  return invoke<BodyFatEstimate>('body-fat', { images });
}
