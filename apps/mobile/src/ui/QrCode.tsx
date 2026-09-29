import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

/** QR code as one SVG path (dark on white with quiet zone, so every camera can read it). */
export function QrCode({ value, size = 220, testID }: { value: string; size?: number; testID?: string }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    // one rectangle per horizontal run of dark modules (small path, no seams inside a run)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        let len = 1;
        while (c + len < n && qr.isDark(r, c + len)) len++;
        d += `M${c + 4} ${r + 4}h${len}v1h-${len}z`;
        c += len - 1;
      }
    return { path: d, count: n + 8 };
  }, [value]);
  return (
    <View testID={testID} accessibilityRole="image" accessibilityLabel={`QR-Code: ${value}`} style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect width={count} height={count} fill="#FFFFFF" />
        <Path d={path} fill="#0B0D12" />
      </Svg>
    </View>
  );
}
