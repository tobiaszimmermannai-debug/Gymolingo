import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from './theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'accent' | 'outline';
  padding?: number;
  testID?: string;
  accessibilityLabel?: string;
}

export function Card({ children, style, onPress, variant = 'default', padding = spacing.lg, testID, accessibilityLabel }: CardProps) {
  const base: ViewStyle = {
    backgroundColor: variant === 'accent' ? colors.accentSoft : variant === 'outline' ? 'transparent' : variant === 'elevated' ? colors.surface2 : colors.surface,
    borderRadius: radius.xl,
    padding,
    borderWidth: 1,
    borderColor: variant === 'accent' ? 'rgba(198,244,50,0.28)' : colors.border,
  };
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[base, style]}>
      {children}
    </View>
  );
}
