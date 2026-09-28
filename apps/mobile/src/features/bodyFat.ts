/**
 * Body fat estimates: Navy formula from tape measurements (free, on-device) and an
 * optional visual AI estimate from progress photos. Both are marked as estimates.
 */
import { router } from 'expo-router';
import { todayISO, type PhotoPose, type ProgressPhoto } from '@gymolingo/core';
import { update, useDB } from '@/data/store';
import { requestSync } from '@/data/sync';
import { estimateBodyFat } from '@/lib/ai';
import { prepareForAi } from '@/lib/imageResize';

export type BodyFatSource = 'ai' | 'navy';
export const BODY_FAT_NOTE: Record<BodyFatSource, string> = {
  ai: 'KFA: KI-Schätzung aus Fotos',
  navy: 'KFA: Navy-Formel aus Körpermaßen',
};

/** Stores the value on today's weight entry, or opens the weight screen prefilled. */
export function applyBodyFat(pct: number, source: BodyFatSource): 'saved' | 'needs_weight' {
  const today = todayISO();
  const entry = Object.values(useDB.getState().tables.weight_entries).find((w) => !w.deleted && w.date === today);
  if (entry) {
    update('weight_entries', entry.id, { body_fat_pct: pct, note: BODY_FAT_NOTE[source] });
    requestSync();
    return 'saved';
  }
  router.push(`/body/weight?bf=${pct}&src=${source}`);
  return 'needs_weight';
}

/** Newest local photo per pose, all from the same ~2-week window (comparable shape). */
export function photosForEstimate(photos: ProgressPhoto[]): ProgressPhoto[] {
  const local = photos.filter((p) => !p.deleted && p.local_uri).sort((a, b) => b.date.localeCompare(a.date));
  if (!local.length) return [];
  const newest = local[0].date;
  const cutoff = new Date(new Date(`${newest}T12:00:00`).getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const byPose = new Map<PhotoPose, ProgressPhoto>();
  for (const p of local) if (p.date >= cutoff && !byPose.has(p.pose)) byPose.set(p.pose, p);
  return (['front', 'side', 'back'] as PhotoPose[]).map((k) => byPose.get(k)).filter((p): p is ProgressPhoto => !!p);
}

export async function estimateFromPhotos(photos: ProgressPhoto[]) {
  const images = [];
  for (const p of photos) images.push({ ...(await prepareForAi(p.local_uri!)), pose: p.pose });
  return estimateBodyFat(images);
}
