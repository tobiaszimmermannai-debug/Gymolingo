/**
 * Invite friends: a personal link (…/invite?c=CODE) shared via WhatsApp, the share
 * sheet, clipboard or QR code. Whoever opens it and signs in becomes a friend right
 * away; without an account the plain app link is shared.
 */
import { Platform, Share } from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { setPrefs, useDB } from '@/data/store';
import { refreshFriendsActivity } from './presence';

export type InviteInfo = { display_name: string; avatar_emoji: string; username: string | null };

/** Public address of the app (web: current origin + GitHub Pages sub folder). */
export function appUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${(process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '')}`;
  return (process.env.EXPO_PUBLIC_APP_URL ?? Linking.createURL('')).replace(/\/$/, '');
}

export const inviteUrl = (code: string | null) => (code ? `${appUrl()}/invite?c=${code}` : `${appUrl()}/`);

export const inviteMessage = (url: string) => `Trainierst du mit mir? 💪 Gymolingo: Training, Ernährung, KI-Coach und Streaks – kostenlos, direkt im Browser (über „Zum Home-Bildschirm“ bekommst du das App-Icon).\n${url}`;

/** Normalizes a code from a link or manual input. */
export const cleanInviteCode = (raw: string) => raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export async function myInviteCode(renew = false): Promise<string | null> {
  if (!supabase || !useDB.getState().accountUserId) return null;
  const { data, error } = await supabase.rpc(renew ? 'renew_invite_code' : 'my_invite_code');
  if (error) throw new Error(error.code === 'PGRST202' ? 'Datenbank-Update nötig (Einladungen) – siehe Einrichtungs-Checkliste.' : error.message);
  return data as string;
}

export async function inviteInfo(code: string): Promise<InviteInfo | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('invite_info', { p_code: code });
  if (error || !Array.isArray(data) || !data.length) return null;
  return data[0] as InviteInfo;
}

/** Accepts the invite stored from a link (runs after sign-in and in the background sync). */
export async function acceptPendingInvite(): Promise<'accepted' | 'invalid' | 'skipped'> {
  const code = useDB.getState().prefs.pendingInvite;
  if (!code || !supabase || !useDB.getState().accountUserId) return 'skipped';
  const { data, error } = await supabase.rpc('accept_invite', { p_code: code });
  if (error) {
    // invalid/renewed/own link: forget it; network or missing update: try again later
    if (error.code === 'P0002' || error.code === '22023') {
      setPrefs({ pendingInvite: null });
      return 'invalid';
    }
    return 'skipped';
  }
  const inviter = Array.isArray(data) ? data[0] : null;
  setPrefs({ pendingInvite: null, inviteJoined: inviter ? { name: inviter.display_name || 'Dein Freund', emoji: inviter.avatar_emoji || '💪' } : null });
  void refreshFriendsActivity(true);
  return 'accepted';
}

export const canShareNatively = () => Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

export const shareInvite = (url: string) => Share.share({ message: inviteMessage(url) }).catch(() => undefined);

/** WhatsApp with the invite text prefilled; on the web in a new tab so the app stays open. */
export function openWhatsApp(url: string) {
  const wa = `https://wa.me/?text=${encodeURIComponent(inviteMessage(url))}`;
  if (Platform.OS !== 'web') return void Linking.openURL(wa);
  const w = window.open(wa, '_blank');
  if (w) w.opener = null;
  else window.location.href = wa;
}

export const copyInvite = (url: string) => Clipboard.setStringAsync(url);
