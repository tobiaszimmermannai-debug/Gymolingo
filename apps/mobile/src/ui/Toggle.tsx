import { Switch, View } from 'react-native';
import { colors, spacing } from './theme';
import { Text } from './Text';

export function ToggleRow({ label, description, value, onChange, testID, disabled }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; testID?: string; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{label}</Text>
        {description && (
          <Text variant="small" tone="secondary">
            {description}
          </Text>
        )}
      </View>
      <Switch
        testID={testID}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.surface3, true: colors.accent }}
        thumbColor={value ? colors.onAccent : colors.textSecondary}
        {...({ activeThumbColor: colors.onAccent } as object)}
        accessibilityLabel={label}
      />
    </View>
  );
}
