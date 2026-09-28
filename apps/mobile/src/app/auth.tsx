import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Segmented } from '@/ui/Chip';
import { spacing } from '@/ui/theme';
import { resetPassword, signIn, signUp } from '@/features/account';
import { useDB } from '@/data/store';
import { isBackendConfigured } from '@/lib/supabase';

export default function Auth() {
  const params = useLocalSearchParams<{ mode?: 'signin' | 'signup' }>();
  const [mode, setMode] = useState<'signin' | 'signup'>(params.mode ?? 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(useDB.getState().tables.athlete_profiles[useDB.getState().userId]?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Bitte eine gültige E-Mail-Adresse eingeben.');
    setBusy(true);
    const r = mode === 'signup' ? await signUp(email, password, name.trim()) : await signIn(email, password);
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Fehlgeschlagen');
    if ('needsConfirmation' in r && r.needsConfirmation) return setInfo('Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben, und melde dich dann an.');
    const onboarded = useDB.getState().tables.athlete_profiles[useDB.getState().userId]?.onboarding_completed;
    router.replace(onboarded ? '/' : '/onboarding');
  };

  if (!isBackendConfigured) {
    return (
      <Screen title="Konto" back>
        <Text tone="secondary">Diese Installation ist ohne Server konfiguriert – Konten sind nicht verfügbar.</Text>
      </Screen>
    );
  }

  return (
    <Screen title={mode === 'signup' ? 'Konto erstellen' : 'Anmelden'} back testID="auth-screen">
      <Segmented options={[{ value: 'signup', label: 'Registrieren' }, { value: 'signin', label: 'Anmelden' }]} value={mode} onChange={(v) => setMode(v as 'signin' | 'signup')} testIDPrefix="auth-mode" />
      <Card>
        {mode === 'signup' && <Input label="Name" value={name} onChangeText={setName} autoComplete="name" testID="auth-name" containerStyle={{ marginBottom: spacing.sm }} />}
        <Input label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" testID="auth-email" />
        <Input
          label="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          testID="auth-password"
          containerStyle={{ marginTop: spacing.sm }}
          hint={mode === 'signup' ? 'Mindestens 8 Zeichen' : undefined}
          onSubmitEditing={submit}
        />
        {error && (
          <Text tone="danger" variant="small" style={{ marginTop: spacing.sm }} testID="auth-error">
            {error}
          </Text>
        )}
        {info && (
          <Text tone="accent" variant="small" style={{ marginTop: spacing.sm }}>
            {info}
          </Text>
        )}
        <Button title={mode === 'signup' ? 'Konto erstellen' : 'Anmelden'} style={{ marginTop: spacing.md }} onPress={submit} loading={busy} testID="auth-submit" />
        {mode === 'signin' && (
          <Button
            title="Passwort vergessen?"
            variant="ghost"
            size="sm"
            onPress={async () => {
              if (!email.trim()) return setError('Bitte zuerst die E-Mail-Adresse eingeben.');
              const r = await resetPassword(email);
              if (r.ok) setInfo('Falls ein Konto existiert, haben wir dir eine E-Mail zum Zurücksetzen geschickt.');
              else setError(r.error ?? 'Fehlgeschlagen');
            }}
          />
        )}
      </Card>
      <Text variant="small" tone="muted">
        Mit der Registrierung werden deine Daten auf dem Gymolingo-Server (Supabase) gespeichert und ausschließlich für die App-Funktionen verwendet. Du kannst sie jederzeit exportieren oder dein Konto löschen.
      </Text>
    </Screen>
  );
}
