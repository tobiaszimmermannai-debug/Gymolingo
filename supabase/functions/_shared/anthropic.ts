/**
 * Anthropic client for the edge functions. The API key only exists as a
 * Supabase secret (`supabase secrets set ANTHROPIC_API_KEY=...`), never in the app.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0';

export const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5';

export function anthropicClient(): Anthropic | null {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  return key ? new Anthropic({ apiKey: key }) : null;
}

type CreateParams = {
  system: string;
  messages: Anthropic.MessageParam[];
  effort: 'low' | 'medium' | 'high';
  jsonSchema?: Record<string, unknown>;
};

/**
 * One Messages API call with the recommended defaults for Claude Opus 5:
 * adaptive thinking (default), effort per route, server-side refusal fallback,
 * optional structured output. Returns the concatenated text or null on refusal.
 */
export async function complete(client: Anthropic, p: CreateParams): Promise<{ text: string | null; model: string; refused: boolean }> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: p.system,
    messages: p.messages,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: p.jsonSchema ? { effort: p.effort, format: { type: 'json_schema', schema: p.jsonSchema } } : { effort: p.effort },
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
  if (response.stop_reason === 'refusal') return { text: null, model: response.model, refused: true };
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { text, model: response.model, refused: false };
}

export function describeError(e: unknown): { status: number; message: string } {
  if (e instanceof Anthropic.RateLimitError) return { status: 429, message: 'Die KI ist gerade ausgelastet – bitte gleich nochmal versuchen.' };
  if (e instanceof Anthropic.AuthenticationError) return { status: 503, message: 'KI-Schlüssel auf dem Server ist ungültig.' };
  if (e instanceof Anthropic.BadRequestError) return { status: 400, message: `Ungültige KI-Anfrage: ${e.message}` };
  if (e instanceof Anthropic.APIError) return { status: 502, message: `KI-Dienst nicht erreichbar (${e.status ?? 'Netzwerk'}).` };
  return { status: 500, message: e instanceof Error ? e.message : String(e) };
}
