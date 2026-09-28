import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { Tabs } from 'expo-router/js-tabs';
import { colors, radius } from './theme';
import { Text } from './Text';
import { haptic } from '@/lib/haptics';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  training: ['barbell', 'barbell-outline'],
  nutrition: ['restaurant', 'restaurant-outline'],
  progress: ['stats-chart', 'stats-chart-outline'],
  community: ['people', 'people-outline'],
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 8,
        backgroundColor: 'rgba(11,12,14,0.96)',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', width: '100%', maxWidth: 560 }}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = descriptors[route.key]?.options.title ?? route.name;
          const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                haptic('light');
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 }}
            >
              <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: focused ? colors.accentSoft : 'transparent' }}>
                <Ionicons name={focused ? on : off} size={22} color={focused ? colors.accent : colors.textMuted} />
              </View>
              <Text variant="caption" style={{ textTransform: 'none', letterSpacing: 0.1, fontSize: 10.5 }} color={focused ? colors.text : colors.textMuted}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
