import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, C, Card, Chip, s, TrainRow } from '../components/ui';
import { STATIONS, type Station } from '../core/models';
import { parseIntent } from '../core/naturalLanguage';
import { openDate } from '../core/openingRule';
import type { Recommendation } from '../core/recommender';
import { expandDates, type Period } from '../core/recurrence';
import { dayKeyOf, formatDateTime, formatDay, formatHM, kstDate, minutesOfDay, weekdayKo, type DayKey } from '../core/time';
import { useStore } from '../store';

type Mode = 'single' | 'thisMonth' | 'nextMonth';
const MODES: [Mode, string][] = [['single', '하루'], ['thisMonth', '이번 달'], ['nextMonth', '다음 달']];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function AddPlanScreen({ initialDay, onDone }: { initialDay: DayKey; onDone: () => void }) {
  const store = useStore();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('single');
  const [day, setDay] = useState<DayKey>(initialDay < dayKeyOf(new Date()) ? dayKeyOf(new Date()) : initialDay);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [minutes, setMinutes] = useState(7 * 60);
  const [from, setFrom] = useState<Station>(STATIONS[0]);
  const [to, setTo] = useState<Station>(STATIONS[STATIONS.length - 1]);
  const [preview, setPreview] = useState<Recommendation>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(Platform.OS === 'ios');
  const [showTime, setShowTime] = useState(Platform.OS === 'ios');
  const [hint, setHint] = useState<string>();

  const days = useMemo(() => {
    const period: Period = mode === 'single' ? { kind: 'single', day } : { kind: mode };
    return expandDates({ period, weekdays });
  }, [mode, day, weekdays]);

  useEffect(() => setPreview(undefined), [from.id, to.id, minutes, days[0]]);

  const applyText = () => {
    const intent = parseIntent(text);
    if (!intent) return;
    const p = intent.request.period;
    if (p.kind === 'single') {
      setMode('single');
      setDay(p.day);
    } else if (p.kind === 'thisMonth' || p.kind === 'nextMonth') setMode(p.kind);
    setWeekdays(intent.request.weekdays);
    if (intent.preferredMinutes != null) setMinutes(intent.preferredMinutes);
    if (intent.from) setFrom(intent.from);
    if (intent.to) setTo(intent.to);
    const missing = [!intent.from && '출발역', !intent.to && '도착역', intent.preferredMinutes == null && '시간'].filter(Boolean);
    setHint(missing.length ? `${missing.join(', ')}은(는) 아래에서 골라 주세요.` : '아래 내용을 확인하고 저장하세요.');
  };

  const loadPreview = async () => {
    if (!days[0]) return;
    setLoading(true);
    setPreview(await store.recommendFor(from, to, days[0], minutes));
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    await store.createPlans(days, from, to, minutes);
    setSaving(false);
    onDone();
  };

  const toggleWd = (wd: number) =>
    setWeekdays((w) => (w.includes(wd) ? w.filter((x) => x !== wd) : [...w, wd].sort()));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Card title="말로 등록">
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="예: 이번달 매주 월요일 7시 서울에서 부산"
          placeholderTextColor={C.sub}
          onSubmitEditing={applyText}
          returnKeyType="done"
        />
        <Btn title="입력 채우기" kind="plain" onPress={applyText} disabled={!text.trim()} />
        {hint ? <Text style={{ color: C.sub, fontSize: 13 }}>{hint}</Text> : null}
      </Card>

      <Card title="구간">
        <Text style={{ color: C.sub }}>출발</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {STATIONS.map((st) => (
            <Chip key={st.id} label={st.name} on={from.id === st.id} onPress={() => setFrom(st)} />
          ))}
        </View>
        <Text style={{ color: C.sub, marginTop: 4 }}>도착</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {STATIONS.map((st) => (
            <Chip key={st.id} label={st.name} on={to.id === st.id} onPress={() => setTo(st)} />
          ))}
        </View>
      </Card>

      <Card title="날짜와 시간">
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {MODES.map(([m, label]) => (
            <Chip key={m} label={label} on={mode === m} onPress={() => setMode(m)} />
          ))}
        </View>
        {mode === 'single' ? (
          <>
            {Platform.OS === 'android' && <Btn kind="plain" title={`승차일 ${formatDay(day)}`} onPress={() => setShowDate(true)} />}
            {showDate && (
              <DateTimePicker
                value={kstDate(day, 12 * 60)}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                locale="ko-KR"
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setShowDate(false);
                  if (d) setDay(dayKeyOf(d));
                }}
              />
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {WEEK_ORDER.map((wd) => (
                <Chip key={wd} label={weekdayKo(wd)} on={weekdays.includes(wd)} onPress={() => toggleWd(wd)} />
              ))}
            </View>
            <Text style={{ color: C.sub, fontSize: 13 }}>
              {days.length}일: {days.slice(0, 6).map(formatDay).join(', ')}
              {days.length > 6 ? ' …' : ''}
            </Text>
          </>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, color: C.text }}>희망 출발</Text>
          {Platform.OS === 'android' && <Btn kind="plain" title={formatHM(minutes)} onPress={() => setShowTime(true)} />}
          {showTime && (
            <DateTimePicker
              value={kstDate(dayKeyOf(new Date()), minutes)}
              mode="time"
              minuteInterval={5}
              locale="ko-KR"
              onChange={(_, d) => {
                if (Platform.OS === 'android') setShowTime(false);
                if (d) setMinutes(minutesOfDay(d));
              }}
            />
          )}
        </View>
      </Card>

      <Card title={`추천 열차 ${days[0] ? `(${formatDay(days[0])})` : ''}`}>
        {loading ? (
          <ActivityIndicator />
        ) : preview ? (
          preview.best ? (
            <>
              <TrainRow train={preview.best} badge="추천" />
              {preview.alternatives.map((t) => (
                <TrainRow key={t.trainNo} train={t} badge="차선" />
              ))}
            </>
          ) : (
            <Text style={{ color: C.sub }}>조건에 맞는 열차가 없습니다</Text>
          )
        ) : (
          <Btn kind="plain" title="추천 보기" onPress={loadPreview} disabled={!days[0] || from.id === to.id} />
        )}
        {days[0] ? (
          <Text style={{ color: C.sub, fontSize: 13 }}>예매 오픈: {formatDateTime(openDate(days[0]))}</Text>
        ) : null}
        {days.length > 1 ? (
          <Text style={{ color: C.sub, fontSize: 13 }}>저장하면 날짜마다 가장 맞는 열차를 골라 둡니다.</Text>
        ) : null}
      </Card>

      <View style={{ marginHorizontal: 16, marginTop: 20 }}>
        <Btn
          title={saving ? '저장 중…' : `${days.length}개 일정 저장`}
          onPress={save}
          disabled={saving || days.length === 0 || from.id === to.id}
        />
      </View>
    </ScrollView>
  );
}
