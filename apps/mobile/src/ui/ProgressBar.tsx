import { View } from 'react-native';
import { colors, radius } from './theme';

export function ProgressBar({ progress, color = colors.accent, height = 8, track = colors.surface3, overColor }: { progress: number; color?: string; height?: number; track?: string; overColor?: string }) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View style={{ height, backgroundColor: track, borderRadius: radius.pill, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <View style={{ width: `${p * 100}%`, height, backgroundColor: progress > 1.02 && overColor ? overColor : color, borderRadius: radius.pill }} />
    </View>
  );
}
