/** Web: photos are kept as data URLs inside IndexedDB. */
export async function persistPhoto(sourceUri: string, base64: string | null, _id: string): Promise<string> {
  if (base64) return `data:image/jpeg;base64,${base64}`;
  return sourceUri;
}

export async function deletePhotoFile(_uri: string | null) {}

export async function readBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri.split(',')[1];
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
