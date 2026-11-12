import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';

export const colors = {
  primary: '#1B6B3A',
  primaryDark: '#124D29',
  primarySoft: '#E5F2EA',
  accent: '#D4A017',
  bg: '#F4F6F4',
  card: '#FFFFFF',
  text: '#1C1F1D',
  muted: '#6B746E',
  border: '#DCE2DE',
  danger: '#C0392B',
  birdie: '#D64545',
  bogey: '#2F6DB5',
};

export function Screen({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.75 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** パーとの差で打数に色を付ける */
export function strokeColor(strokes: number | null | undefined, par: number) {
  if (strokes == null) return colors.muted;
  if (strokes < par) return colors.birdie;
  if (strokes > par) return colors.bogey;
  return colors.text;
}

export function formatToPar(n: number) {
  return n === 0 ? 'E' : n > 0 ? `+${n}` : String(n);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.primarySoft },
  button_danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  button_ghost: { backgroundColor: 'transparent' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  buttonText_primary: { color: '#fff' },
  buttonText_secondary: { color: colors.primaryDark },
  buttonText_danger: { color: colors.danger },
  buttonText_ghost: { color: colors.primary },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  segmentTextActive: { color: colors.primary },
});

export function Stepper({
  value,
  min,
  max,
  onChange,
  disabled,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <View style={[stepperStyles.stepper, disabled && { opacity: 0.4 }]}>
      <Pressable
        accessibilityLabel={label ? `${label}を減らす` : '減らす'}
        disabled={disabled}
        onPress={() => onChange(Math.max(min, value - 1))}
        style={stepperStyles.stepBtn}
        hitSlop={4}
      >
        <Text style={stepperStyles.stepText}>−</Text>
      </Pressable>
      <Text style={stepperStyles.stepValue}>{value}</Text>
      <Pressable
        accessibilityLabel={label ? `${label}を増やす` : '増やす'}
        disabled={disabled}
        onPress={() => onChange(Math.min(max, value + 1))}
        style={stepperStyles.stepBtn}
        hitSlop={4}
      >
        <Text style={stepperStyles.stepText}>＋</Text>
      </Pressable>
    </View>
  );
}

type NoticeTone = 'info' | 'warning' | 'success' | 'danger';
const noticeColors: Record<NoticeTone, { bg: string; fg: string }> = {
  info: { bg: '#E8F0FA', fg: '#24527F' },
  warning: { bg: '#FDF3DC', fg: '#7A5A0E' },
  success: { bg: colors.primarySoft, fg: colors.primaryDark },
  danger: { bg: '#FBEAEA', fg: '#8E2A20' },
};

export function Notice({ tone = 'info', children }: { tone?: NoticeTone; children: ReactNode }) {
  const c = noticeColors[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 10, padding: 12 }}>
      <Text style={{ color: c.fg, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[stepperStyles.chip, selected && stepperStyles.chipSelected, disabled && { opacity: 0.4 }]}
    >
      <Text style={[stepperStyles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const stepperStyles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.primaryDark, fontSize: 18, fontWeight: '700' },
  stepValue: { minWidth: 28, textAlign: 'center', fontWeight: '700', fontSize: 16, color: colors.text },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
});

/** 入力欄から離れたときだけ保存する（1文字ごとに通信しないため） */
export function CommitField({
  label,
  value,
  onCommit,
  placeholder,
  style,
}: {
  label?: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  style?: TextInputProps['style'];
}) {
  const [text, setText] = useState(value);
  // 他の端末などで値が変わったら、入力欄にも反映する
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setText(value);
  }
  const input = (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => text !== value && onCommit(text)}
      onSubmitEditing={() => text !== value && onCommit(text)}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      style={style ?? styles.input}
    />
  );
  if (!label) return input;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {input}
    </View>
  );
}
