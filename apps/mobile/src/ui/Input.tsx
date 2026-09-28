import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing } from './theme';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  suffix?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input = forwardRef<TextInput, InputProps>(function Input({ label, hint, error, suffix, containerStyle, style, ...rest }, ref) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label && (
        <Text variant="smallMedium" tone="secondary">
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface2,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : focus ? colors.accent : colors.border,
          paddingHorizontal: spacing.md,
        }}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocus(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            rest.onBlur?.(e);
          }}
          style={[{ flex: 1, minWidth: 0, color: colors.text, fontFamily: fonts.medium, fontSize: 16, paddingVertical: 12, outlineStyle: 'none' } as never, style]}
        />
        {suffix && (
          <Text variant="smallMedium" tone="muted">
            {suffix}
          </Text>
        )}
      </View>
      {(error || hint) && (
        <Text variant="small" tone={error ? 'danger' : 'muted'}>
          {error || hint}
        </Text>
      )}
    </View>
  );
});

/** Parses German/English decimal input ("82,5" or "82.5"). */
export function parseDecimal(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
