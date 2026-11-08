import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { TrainCandidate } from '../core/models';
import { formatHM, minutesOfDay } from '../core/time';

export const C = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  sub: '#6E6E73',
  line: '#E5E5EA',
  accent: '#005BAC',
  danger: '#FF3B30',
};

export function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.cardWrap, style]}>
      {title ? <Text style={s.cardTitle}>{title}</Text> : null}
      <View style={s.card}>{children}</View>
    </View>
  );
}

export function Btn({
  title,
  onPress,
  kind = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'plain' | 'danger';
  disabled?: boolean;
}) {
  const bg = kind === 'primary' ? C.accent : 'transparent';
  const color = kind === 'primary' ? '#fff' : kind === 'danger' ? C.danger : C.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Text style={[s.btnText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: C.accent, borderColor: C.accent }]}>
      <Text style={{ color: on ? '#fff' : C.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function TrainRow({ train, badge, onPress }: { train: TrainCandidate; badge?: string; onPress?: () => void }) {
  const dep = formatHM(minutesOfDay(new Date(train.departure)));
  const arr = formatHM(minutesOfDay(new Date(train.arrival)));
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={s.row}>
      {badge ? (
        <Text style={[s.badge, badge === '추천' ? { backgroundColor: '#DCEBFA', color: C.accent } : null]}>{badge}</Text>
      ) : null}
      <Text style={s.rowMain}>
        {dep} → {arr}
      </Text>
      <Text style={s.rowSub}>
        {train.gradeName} {train.trainNo}
        {train.adultFare ? ` · ${train.adultFare.toLocaleString()}원` : ''}
      </Text>
    </Pressable>
  );
}

export function Line({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.lineRow}>
      <Text style={{ color: C.sub, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: color ?? C.text, fontSize: 15, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  cardWrap: { marginHorizontal: 16, marginTop: 16 },
  cardTitle: { color: C.sub, fontSize: 13, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 12, gap: 8 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '600' },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  rowMain: { fontSize: 16, color: C.text, fontVariant: ['tabular-nums'] },
  rowSub: { fontSize: 14, color: C.sub, marginLeft: 'auto' },
  badge: { fontSize: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: '#EEE', color: C.sub },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 10, fontSize: 16, color: C.text },
});
