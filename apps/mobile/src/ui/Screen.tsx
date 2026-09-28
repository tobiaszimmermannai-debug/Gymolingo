import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, MAX_CONTENT_WIDTH, spacing } from './theme';
import { Text } from './Text';
import { IconButton } from './Button';

interface ScreenProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  tabBarPadding?: boolean;
  testID?: string;
}

export function Screen({ children, title, subtitle, back, right, scroll = true, contentStyle, footer, refreshing, onRefresh, keyboardShouldPersistTaps = 'handled', tabBarPadding, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const header = (title || back || right) && (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm }}>
      {back && <IconButton icon="chevron-back" accessibilityLabel="Zurück" testID="back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
      <View style={{ flex: 1 }}>
        {title && (
          <Text variant={back ? 'h2' : 'h1'} numberOfLines={1}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text variant="small" tone="secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
  const inner: ViewStyle = { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg, gap: spacing.lg };
  const bottomPad = (tabBarPadding ? 96 : spacing.xxxl) + insets.bottom;
  return (
    <KeyboardAvoidingView testID={testID} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      {!header && <View style={{ height: insets.top }} />}
      {header && <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH + spacing.lg * 2, alignSelf: 'center' }}>{header}</View>}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[inner, { paddingTop: spacing.sm, paddingBottom: bottomPad }, contentStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner, contentStyle]}>{children}</View>
      )}
      {footer && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgElevated }}>
          <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}>{footer}</View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

export function Section({ title, action, children, style }: { title?: string; action?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: spacing.md }, style]}>
      {(title || action) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {title && <Text variant="h3">{title}</Text>}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function Row({ children, gap = spacing.md, style, wrap }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}
