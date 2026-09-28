/**
 * Community API (Supabase RPCs). All privacy checks happen server-side in
 * SECURITY DEFINER functions – the client never reads other users' rows.
 */
import { supabase } from '@/lib/supabase';

export interface FriendRow {
  request_id: string;
  user_id: string;
  username: string | null;
  display_name: string;
  avatar_emoji: string;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
}

export interface SearchRow {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  friendship_status: 'friends' | 'incoming' | 'outgoing' | 'declined' | null;
}

export interface LeaderRow {
  user_id: string;
  username: string | null;
  display_name: string;
  avatar_emoji: string;
  is_me: boolean;
  steps: number | null;
  workouts: number | null;
  volume_kg: number | null;
  goal_completion_pct: number | null;
}

export interface ChallengeRow {
  id: string;
  title: string;
  metric: 'steps' | 'workouts' | 'volume' | 'goal_completion' | 'protein_days';
  start_date: string;
  end_date: string;
  creator_name: string;
  my_status: 'invited' | 'joined' | 'declined';
  participants: number;
}

export interface ChallengeLeaderRow {
  user_id: string;
  display_name: string;
  avatar_emoji: string;
  is_me: boolean;
  value: number | null;
  shared: boolean;
}

export interface PublicProfile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_emoji: string;
}

function client() {
  if (!supabase) throw new Error('Community benötigt ein Konto.');
  return supabase;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const community = {
  async myProfile(userId: string): Promise<PublicProfile | null> {
    const { data, error } = await client().from('profiles').select('id, username, display_name, avatar_emoji').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data as PublicProfile | null;
  },
  async updateProfile(userId: string, patch: Partial<Omit<PublicProfile, 'id'>>): Promise<string | null> {
    const { error } = await client().from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', userId);
    if (!error) return null;
    if (error.code === '23505') return 'Dieser Benutzername ist leider schon vergeben.';
    if (error.code === '23514') return 'Benutzername: 3–20 Zeichen, nur Kleinbuchstaben, Zahlen, Punkt und Unterstrich.';
    return error.message;
  },
  friends: () => rpc<FriendRow[]>('list_friends'),
  search: (q: string) => rpc<SearchRow[]>('search_users', { p_query: q }),
  sendRequest: (username: string) => rpc<string>('send_friend_request', { p_username: username }),
  respond: (requestId: string, accept: boolean) => rpc<void>('respond_friend_request', { p_request_id: requestId, p_accept: accept }),
  remove: (userId: string) => rpc<void>('remove_friend', { p_user_id: userId }),
  profile: (userId: string) => rpc<Record<string, unknown>>('get_friend_profile', { p_user_id: userId }),
  leaderboard: (from: string, to: string) => rpc<LeaderRow[]>('friend_leaderboard', { p_from: from, p_to: to }),
  challenges: () => rpc<ChallengeRow[]>('list_challenges'),
  createChallenge: (title: string, metric: ChallengeRow['metric'], start: string, end: string, invitees: string[]) =>
    rpc<string>('create_challenge', { p_title: title, p_metric: metric, p_start: start, p_end: end, p_invitees: invitees }),
  respondChallenge: (id: string, accept: boolean) => rpc<void>('respond_challenge', { p_challenge_id: id, p_accept: accept }),
  challengeLeaderboard: (id: string) => rpc<ChallengeLeaderRow[]>('challenge_leaderboard', { p_challenge_id: id }),
};

export const METRIC_LABELS: Record<ChallengeRow['metric'], { label: string; unit: string }> = {
  steps: { label: 'Schritte', unit: 'Schritte' },
  workouts: { label: 'Trainings', unit: 'Trainings' },
  volume: { label: 'Trainingsvolumen', unit: 'kg' },
  goal_completion: { label: 'Zielerfüllung', unit: '%' },
  protein_days: { label: 'Tage mit Proteinziel', unit: 'Tage' },
};
