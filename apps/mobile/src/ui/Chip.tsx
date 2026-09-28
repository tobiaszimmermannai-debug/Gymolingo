import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from './theme';
import { Text } from './Text';
import { haptic } from '@/lib/haptics';

export function Chip({ label, selected, onPress, icon, testID, style }: { label: string; selected?: boolean; onPress?: () => void; icon?: string; testID?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={
        onPress
          ? () => {
              haptic('light');
              onPress();
            }
          : undefined
      }
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.md,
          paddingVertical: 8,
          borderRadius: radius.pill,
          backgroundColor: selected ? colors.accent : colors.surface2,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon && <Text variant="smallMedium">{icon}</Text>}
      <Text variant="smallMedium" color={selected ? colors.onAccent : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange, multi, testIDPrefix }: {
  options: { value: T; label: string; icon?: string }[];
  value: T | T[];
  onChange: (v: T | T[]) => void;
  multi?: boolean;
  testIDPrefix?: string;
}) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => (
        <Chip
          key={o.value}
          testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
          label={o.label}
          icon={o.icon}
          selected={selected(o.value)}
          onPress={() => {
            if (multi && Array.isArray(value)) onChange(value.includes(o.value) ? value.filter((x) => x !== o.value) : [...value, o.value]);
            else onChange(o.value);
          }}
        />
      ))}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testIDPrefix }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testIDPrefix?: string }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 3, borderWidth: 1, borderColor: colors.border }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic('light');
              onChange(o.value);
            }}
            style={{ flex: 1, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: active ? colors.surface3 : 'transparent', alignItems: 'center' }}
          >
            <Text variant="smallMedium" tone={active ? 'default' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'muted' | 'danger' | 'warning' }) {
  const bg = tone === 'accent' ? colors.accentSoft : tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? 'rgba(245,184,61,0.14)' : colors.surface3;
  const fg = tone === 'accent' ? colors.accent : tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.textSecondary;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: bg, alignSelf: 'flex-start' }}>
      <Text variant="caption" color={fg}>
        {label}
      </Text>
    </View>
  );
}
