/**
 * Uploads progress photos to the private Supabase bucket `progress-photos`
 * (path: {user_id}/{photo_id}.jpg). Access is restricted by storage RLS.
 */
import { supabase } from '@/lib/supabase';
import { readBase64 } from '@/lib/photos';
import { update, useDB } from '@/data/store';
import { requestSync } from '@/data/sync';

function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function uploadPendingPhotos(): Promise<number> {
  const s = useDB.getState();
  if (!supabase || !s.accountUserId) return 0;
  let n = 0;
  for (const p of Object.values(s.tables.progress_photos)) {
    if (p.deleted || p.storage_path || !p.local_uri) continue;
    try {
      const path = `${s.accountUserId}/${p.id}.jpg`;
      const bytes = base64ToBytes(await readBase64(p.local_uri));
      const { error } = await supabase.storage.from('progress-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) continue;
      update('progress_photos', p.id, { storage_path: path });
      n++;
    } catch {
      // retry next time
    }
  }
  if (n) requestSync();
  return n;
}

export async function deleteRemotePhoto(path: string | null) {
  if (!supabase || !path) return;
  await supabase.storage.from('progress-photos').remove([path]).catch(() => undefined);
}

/** Signed URL for photos that are not available locally (e.g. other device). */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.storage.from('progress-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
