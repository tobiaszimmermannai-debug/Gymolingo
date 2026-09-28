import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the export JSON to a cache file and opens the share sheet (native). */
export async function shareExport(filename: string, json: string): Promise<void> {
  const f = new File(Paths.cache, filename);
  if (f.exists) f.delete();
  f.create();
  f.write(json);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Gymolingo-Datenexport' });
}
