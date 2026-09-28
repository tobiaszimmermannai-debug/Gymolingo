import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDB } from '@/data/store';
import { colors } from '@/ui/theme';

/** Small cloud indicator: synced / syncing / offline / local only. */
export function SyncBadge() {
  const state = useDB((s) => s.syncState);
  const account = useDB((s) => s.accountUserId);
  const dirty = useDB((s) => Object.values(s.dirty).reduce((n, m) => n + Object.keys(m ?? {}).length, 0));
  const icon: keyof typeof Ionicons.glyphMap = !account
    ? 'phone-portrait-outline'
    : state === 'syncing'
      ? 'sync-outline'
      : state === 'offline'
        ? 'cloud-offline-outline'
        : state === 'error'
          ? 'alert-circle-outline'
          : dirty > 0
            ? 'cloud-upload-outline'
            : 'cloud-done-outline';
  const color = state === 'error' ? colors.danger : state === 'offline' ? colors.warning : account ? colors.textSecondary : colors.textMuted;
  const label = !account ? 'Nur lokal gespeichert' : state === 'error' ? 'Sync-Fehler' : state === 'offline' ? 'Offline' : dirty ? `${dirty} Änderungen ausstehend` : 'Synchronisiert';
  return (
    <Pressable testID="sync-badge" onPress={() => router.push('/settings/account')} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}
