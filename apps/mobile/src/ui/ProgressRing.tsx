import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from './theme';

interface Props {
  size: number;
  stroke?: number;
  progress: number; // 0..1+ (values > 1 are shown full, color switches when over)
  color?: string;
  track?: string;
  overColor?: string;
  children?: React.ReactNode;
  testID?: string;
}

export function ProgressRing({ size, stroke = 10, progress, color = colors.accent, track = colors.surface3, overColor, children, testID }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const stroke1 = progress > 1.02 && overColor ? overColor : color;
  return (
    <View testID={testID} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={stroke1}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - p)}
            strokeLinecap="round"
          />
        )}
      </Svg>
      {children}
    </View>
  );
}
