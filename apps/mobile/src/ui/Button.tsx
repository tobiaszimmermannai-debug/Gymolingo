import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from './theme';
import { Text } from './Text';
import { haptic } from '@/lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
  testID?: string;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', icon, iconRight, disabled, loading, style, full, testID }: ButtonProps) {
  const bg: Record<Variant, string> = {
    primary: colors.accent,
    secondary: colors.surface3,
    ghost: 'transparent',
    danger: colors.dangerSoft,
    outline: 'transparent',
  };
  const fg: Record<Variant, string> = {
    primary: colors.onAccent,
    secondary: colors.text,
    ghost: colors.accent,
    danger: colors.danger,
    outline: colors.text,
  };
  const h = size === 'sm' ? 36 : size === 'lg' ? 56 : 46;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
          borderRadius: radius.pill,
          backgroundColor: pressed && variant === 'primary' ? colors.accentPressed : bg[variant],
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: colors.borderStrong,
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {icon && <Ionicons name={icon} size={fs + 3} color={fg[variant]} />}
          <Text variant="bodyMedium" style={{ fontSize: fs, fontFamily: 'Inter_600SemiBold' }} color={fg[variant]}>
            {title}
          </Text>
          {iconRight && <Ionicons name={iconRight} size={fs + 3} color={fg[variant]} />}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  size = 40,
  color = colors.text,
  background = colors.surface2,
  accessibilityLabel,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  background?: string;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </Pressable>
  );
}
