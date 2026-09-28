import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, type as typeScale, type TypeVariant } from './theme';

type Tone = 'default' | 'secondary' | 'muted' | 'accent' | 'danger' | 'success' | 'onAccent' | 'warning';

const toneColor: Record<Tone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  accent: colors.accent,
  danger: colors.danger,
  success: colors.success,
  onAccent: colors.onAccent,
  warning: colors.warning,
};

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  color?: string;
  align?: TextStyle['textAlign'];
}

export function Text({ variant = 'body', tone = 'default', color, align, style, ...rest }: AppTextProps) {
  return <RNText {...rest} style={[typeScale[variant], { color: color ?? toneColor[tone], textAlign: align }, style]} />;
}
