import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/components/ui.tsx';
import { sum } from '@/domain/scoring.ts';

/** 18ホールのパー。タップで 3 → 4 → 5 → 3 と切り替える */
export function ParGrid({
  pars,
  onChange,
  highlight,
}: {
  pars: number[];
  onChange?: (pars: number[]) => void;
  /** 色を付けるホール（隠しホールの表示など） */
  highlight?: Set<number>;
}) {
  const cycle = (index: number) => {
    const next = [...pars];
    next[index] = next[index] >= 5 ? 3 : next[index] + 1;
    onChange?.(next);
  };
  return (
    <View style={{ gap: 6 }}>
      {[0, 9].map((start) => (
        <View key={start} style={{ gap: 2 }}>
          <Text style={styles.half}>
            {start === 0 ? 'OUT' : 'IN'}（パー{sum(pars.slice(start, start + 9))}）
          </Text>
          <View style={styles.row}>
            {pars.slice(start, start + 9).map((par, i) => {
              const index = start + i;
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`${index + 1}番ホール パー${par}`}
                  disabled={!onChange}
                  onPress={() => cycle(index)}
                  style={[styles.cell, par === 3 && styles.par3, par === 5 && styles.par5, highlight?.has(index + 1) && styles.highlight]}
                >
                  <Text style={styles.hole}>{index + 1}</Text>
                  <Text style={styles.value}>{par}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  half: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6, backgroundColor: colors.primarySoft },
  par3: { backgroundColor: '#E8F0FA' },
  par5: { backgroundColor: '#FBF0DC' },
  highlight: { borderWidth: 2, borderColor: colors.accent },
  hole: { fontSize: 10, color: colors.muted },
  value: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
});
