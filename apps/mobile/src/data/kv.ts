/**
 * Native key-value persistence backed by SQLite (no size limit like
 * AsyncStorage's 6 MB on Android). Web uses IndexedDB (kv.web.ts).
 */
import Storage from 'expo-sqlite/kv-store';

export const kv = {
  async get(key: string): Promise<string | null> {
    return Storage.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    await Storage.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    await Storage.removeItemAsync(key);
  },
  async clear(prefix: string): Promise<void> {
    const keys = await Storage.getAllKeysAsync();
    await Promise.all(keys.filter((k) => k.startsWith(prefix)).map((k) => Storage.removeItemAsync(k)));
  },
};
