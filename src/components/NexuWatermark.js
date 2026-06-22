import React from 'react';
import { View, Text, Dimensions } from 'react-native';

export default function NexuWatermark() {
  const { width, height } = Dimensions.get('window');
  const diag = Math.ceil(Math.sqrt(width * width + height * height)) + 40;
  const colW = 110, rowH = 60;
  const cols = Math.ceil(diag / colW) + 2;
  const rows = Math.ceil(diag / rowH) + 2;
  const items = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offset = r % 2 === 0 ? 0 : colW / 2;
      items.push(
        <Text key={`${r}-${c}`} style={{
          position: 'absolute',
          top: r * rowH,
          left: c * colW + offset,
          color: 'rgba(160,160,185,0.16)',
          fontSize: 13,
          fontWeight: '800',
          letterSpacing: 4,
        }}>KONEXU</Text>
      );
    }
  }
  const shift = (diag - Math.min(width, height)) / 2;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <View style={{
        position: 'absolute',
        top: -shift,
        left: -shift,
        width: diag,
        height: diag,
        transform: [{ rotate: '-45deg' }],
      }}>
        {items}
      </View>
    </View>
  );
}
