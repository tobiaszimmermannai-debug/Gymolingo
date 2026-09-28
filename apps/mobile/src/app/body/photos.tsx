import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { formatDateDE, todayISO, type PhotoPose, type ProgressPhoto } from '@gymolingo/core';
import { Screen, Row, Section } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { ChipGroup, Segmented } from '@/ui/Chip';
import { colors, radius, spacing } from '@/ui/theme';
import { useRows } from '@/data/hooks';
import { insert, remove, uuid } from '@/data/store';
import { requestSync } from '@/data/sync';
import { persistPhoto, deletePhotoFile } from '@/lib/photos';
import { deleteRemotePhoto, signedPhotoUrl, uploadPendingPhotos } from '@/features/photoSync';
import { confirm } from '@/lib/dialog';

const POSES: { value: PhotoPose; label: string }[] = [
  { value: 'front', label: 'Vorne' },
  { value: 'side', label: 'Seite' },
  { value: 'back', label: 'Hinten' },
];

/** Progress photos – private by default (stored on device; synced to a private bucket only with an account). */
export default function Photos() {
  const photos = useRows('progress_photos');
  const [pose, setPose] = useState<PhotoPose>('front');
  const [mode, setMode] = useState<'grid' | 'compare'>('grid');
  const [error, setError] = useState<string | null>(null);
  const sorted = useMemo(() => [...photos].sort((a, b) => b.date.localeCompare(a.date)), [photos]);
  const ofPose = sorted.filter((p) => p.pose === pose);

  const add = async (camera: boolean) => {
    setError(null);
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: true, aspect: [3, 4] };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Kamera-Zugriff wurde nicht erlaubt.');
    }
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    const id = uuid();
    const localUri = await persistPhoto(res.assets[0].uri, res.assets[0].base64 ?? null, id);
    insert('progress_photos', { id, date: todayISO(), pose, local_uri: localUri, storage_path: null, note: null });
    requestSync();
    void uploadPendingPhotos();
  };

  const del = async (p: ProgressPhoto) => {
    if (!(await confirm('Foto löschen?', `${formatDateDE(p.date)} · ${POSES.find((x) => x.value === p.pose)?.label}`, 'Löschen', true))) return;
    await deletePhotoFile(p.local_uri);
    await deleteRemotePhoto(p.storage_path);
    remove('progress_photos', p.id);
    requestSync();
  };

  return (
    <Screen title="Fortschrittsbilder" back testID="photos-screen">
      <Text variant="small" tone="secondary">
        🔒 Privat: Fotos bleiben auf deinem Gerät bzw. in deinem privaten Speicher und werden nur geteilt, wenn du es in den Datenschutz-Einstellungen ausdrücklich erlaubst.
      </Text>
      <ChipGroup options={POSES} value={pose} onChange={(v) => setPose(v as PhotoPose)} />
      <Row>
        <Button title="Foto aufnehmen" icon="camera-outline" style={{ flex: 1 }} onPress={() => add(true)} />
        <Button title="Aus Galerie" icon="images-outline" variant="secondary" style={{ flex: 1 }} onPress={() => add(false)} />
      </Row>
      {error && <Text tone="danger">{error}</Text>}
      <Segmented options={[{ value: 'grid', label: 'Übersicht' }, { value: 'compare', label: 'Vergleich' }]} value={mode} onChange={(v) => setMode(v as 'grid' | 'compare')} />
      {ofPose.length === 0 && <Text tone="muted">Noch keine Fotos für diese Ansicht. Tipp: gleiches Licht, gleiche Pose, alle 2–4 Wochen.</Text>}
      {mode === 'compare' && ofPose.length >= 2 ? (
        <Row style={{ alignItems: 'flex-start' }}>
          <PhotoTile photo={ofPose[ofPose.length - 1]} label={`Start · ${formatDateDE(ofPose[ofPose.length - 1].date)}`} />
          <PhotoTile photo={ofPose[0]} label={`Aktuell · ${formatDateDE(ofPose[0].date)}`} />
        </Row>
      ) : (
        <Section>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {ofPose.map((p) => (
              <Pressable key={p.id} onLongPress={() => del(p)} style={{ width: '31%' }} accessibilityLabel={`Foto vom ${formatDateDE(p.date)} (lange drücken zum Löschen)`}>
                <PhotoTile photo={p} label={formatDateDE(p.date)} />
              </Pressable>
            ))}
          </View>
          {ofPose.length > 0 && (
            <Text variant="small" tone="muted">
              Lange drücken zum Löschen.
            </Text>
          )}
        </Section>
      )}
    </Screen>
  );
}

function PhotoTile({ photo, label }: { photo: ProgressPhoto; label: string }) {
  const [uri, setUri] = useState<string | null>(photo.local_uri);
  useEffect(() => {
    if (!photo.local_uri && photo.storage_path) signedPhotoUrl(photo.storage_path).then(setUri);
  }, [photo.local_uri, photo.storage_path]);
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <View style={{ aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface2 }}>
        {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
      </View>
      <Card padding={4} variant="outline">
        <Text variant="small" tone="secondary" align="center">
          {label}
        </Text>
      </Card>
    </View>
  );
}
