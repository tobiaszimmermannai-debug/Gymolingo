/** Stores progress photos in the app's document directory (native). */
import { Directory, File, Paths } from 'expo-file-system';

export async function persistPhoto(sourceUri: string, _base64: string | null, id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'progress-photos');
  if (!dir.exists) dir.create({ idempotent: true });
  const target = new File(dir, `${id}.jpg`);
  await new File(sourceUri).copy(target);
  return target.uri;
}

export async function deletePhotoFile(uri: string | null) {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

export async function readBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}
