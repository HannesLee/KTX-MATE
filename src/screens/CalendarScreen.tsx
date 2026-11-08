import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, C } from '../components/ui';
import { STATUS_COLOR, STATUS_LABEL, type TicketStatus, type TripPlan } from '../core/models';
import {
  addMonthsClamped, dayKeyOf, daysInMonth, firstOfMonth, formatDateTime, formatDay, formatHM,
  makeDayKey, minutesOfDay, parseDayKey, weekday, type DayKey,
} from '../core/time';
import { useStore } from '../store';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export function CalendarScreen({ onOpenPlan }: { onOpenPlan: (id: string) => void }) {
  const { plans } = useStore();
  const today = dayKeyOf(new Date());
  const [month, setMonth] = useState(firstOfMonth(today));
  const [selected, setSelected] = useState<DayKey>(today);

  const byDay = useMemo(() => {
    const m: Record<DayKey, TicketStatus[]> = {};
    for (const p of plans) (m[p.travelDay] ??= []).push(p.status);
    return m;
  }, [plans]);

  const { y, m } = parseDayKey(month);
  const cells: (DayKey | null)[] = [
    ...Array(weekday(month)).fill(null),
    ...Array.from({ length: daysInMonth(y, m) }, (_, i) => makeDayKey(y, m, i + 1)),
  ];

  const dayPlans = plans.filter((p) => p.travelDay === selected);
  const upcoming = plans
    .filter((p) => p.status === 'waitingForOpen' && Date.parse(p.openAt) > Date.now())
    .sort((a, b) => a.openAt.localeCompare(b.openAt))
    .slice(0, 5);
  const needAction = plans.filter((p) => p.status === 'openNotBooked' || p.status === 'needsAlternative');

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={st.monthBar}>
        <Pressable onPress={() => setMonth(addMonthsClamped(month, -1))} hitSlop={12}>
          <Text style={st.arrow}>‹</Text>
        </Pressable>
        <Text style={st.monthTitle}>
          {y}년 {m}월
        </Text>
        <Pressable onPress={() => setMonth(addMonthsClamped(month, 1))} hitSlop={12}>
          <Text style={st.arrow}>›</Text>
        </Pressable>
      </View>

      <View style={st.grid}>
        {WEEK.map((w, i) => (
          <Text key={w} style={[st.week, i === 0 && { color: C.danger }]}>
            {w}
          </Text>
        ))}
        {cells.map((d, i) =>
          d ? (
            <Pressable key={d} onPress={() => setSelected(d)} style={[st.cell, d === selected && st.cellOn]}>
              <Text style={[st.dayNum, d === today && { fontWeight: '700', color: C.accent }]}>{parseDayKey(d).d}</Text>
              <View style={st.dots}>
                {(byDay[d] ?? []).slice(0, 3).map((status, j) => (
                  <View key={j} style={[st.dot, { backgroundColor: STATUS_COLOR[status] }]} />
                ))}
              </View>
            </Pressable>
          ) : (
            <View key={`e${i}`} style={st.cell} />
          ),
        )}
      </View>

      <View style={st.legend}>
        {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[st.dot, { backgroundColor: STATUS_COLOR[k] }]} />
            <Text style={{ fontSize: 12, color: C.sub }}>{STATUS_LABEL[k]}</Text>
          </View>
        ))}
      </View>

      {needAction.length > 0 && (
        <Card title="지금 확인이 필요해요">
          {needAction.map((p) => (
            <PlanRow key={p.id} plan={p} showDay onPress={() => onOpenPlan(p.id)} />
          ))}
        </Card>
      )}

      <Card title={formatDay(selected)}>
        {dayPlans.length === 0 ? (
          <Text style={{ color: C.sub }}>이 날 등록된 기차표가 없습니다</Text>
        ) : (
          dayPlans.map((p) => <PlanRow key={p.id} plan={p} onPress={() => onOpenPlan(p.id)} />)
        )}
      </Card>

      {upcoming.length > 0 && (
        <Card title="다가오는 예매 오픈">
          {upcoming.map((p) => (
            <Pressable key={p.id} onPress={() => onOpenPlan(p.id)} style={st.upRow}>
              <Text style={{ fontSize: 15, color: C.text }}>{formatDateTime(new Date(p.openAt))}</Text>
              <Text style={{ fontSize: 14, color: C.sub }}>
                {formatDay(p.travelDay)} {p.from.name}→{p.to.name}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function PlanRow({ plan, onPress, showDay }: { plan: TripPlan; onPress: () => void; showDay?: boolean }) {
  const time = plan.chosen ? formatHM(minutesOfDay(new Date(plan.chosen.departure))) : formatHM(plan.preferredMinutes);
  return (
    <Pressable onPress={onPress} style={st.planRow}>
      <View style={[st.dot, { width: 10, height: 10, backgroundColor: STATUS_COLOR[plan.status] }]} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>
          {showDay ? `${formatDay(plan.travelDay)} ` : ''}
          {plan.from.name} → {plan.to.name}
        </Text>
        <Text style={{ fontSize: 14, color: C.sub }}>
          {time} {plan.chosen ? `${plan.chosen.gradeName} ${plan.chosen.trainNo}` : '(열차 미선택)'}
          {plan.seat ? ` · ${plan.seat}` : ''}
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: STATUS_COLOR[plan.status] }}>{STATUS_LABEL[plan.status]}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8 },
  arrow: { fontSize: 32, color: C.accent, paddingHorizontal: 8 },
  monthTitle: { fontSize: 18, fontWeight: '600', color: C.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 8 },
  week: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: C.sub, marginBottom: 4 },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  cellOn: { backgroundColor: '#DCEBFA' },
  dayNum: { fontSize: 16, color: C.text },
  dots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  upRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
