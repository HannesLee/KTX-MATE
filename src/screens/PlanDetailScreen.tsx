import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, C, Card, Line, s, TrainRow } from '../components/ui';
import { STATUS_COLOR, STATUS_LABEL, type TrainCandidate } from '../core/models';
import { formatDateTime, formatDay, formatHM, minutesOfDay } from '../core/time';
import { canSyncDirectly, shareICS } from '../services/calendarSync';
import { openKorail } from '../services/handoff';
import { useStore } from '../store';

export function PlanDetailScreen({ planId, onClose }: { planId: string; onClose: () => void }) {
  const store = useStore();
  const plan = store.plans.find((p) => p.id === planId);
  const [seat, setSeat] = useState('');
  const [alts, setAlts] = useState<TrainCandidate[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);

  if (!plan) return null;
  const opened = Date.now() >= Date.parse(plan.openAt);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Line label="상태" value={STATUS_LABEL[plan.status]} color={STATUS_COLOR[plan.status]} />
        <Line label="승차일" value={formatDay(plan.travelDay)} />
        <Line label="구간" value={`${plan.from.name} → ${plan.to.name}`} />
        <Line
          label="열차"
          value={
            plan.chosen
              ? `${formatHM(minutesOfDay(new Date(plan.chosen.departure)))} ${plan.chosen.gradeName} ${plan.chosen.trainNo}`
              : `희망 ${formatHM(plan.preferredMinutes)} (열차 미선택)`
          }
        />
        {plan.seat ? <Line label="좌석" value={plan.seat} /> : null}
        <Line label="예매 오픈" value={formatDateTime(new Date(plan.openAt))} />
      </Card>

      {plan.status !== 'booked' && (
        <>
          <Card title="예매하러 가기">
            <Btn title="코레일+에서 예매하기" onPress={() => openKorail(plan)} />
            <Text style={{ color: C.sub, fontSize: 13 }}>
              {opened
                ? '열차 정보가 클립보드에 복사됩니다.'
                : '아직 오픈 전입니다. 오픈 하루 전, 10분 전, 정각에 알려 드려요.'}
            </Text>
          </Card>

          <Card title="예매했나요?">
            <TextInput
              style={s.input}
              value={seat}
              onChangeText={setSeat}
              placeholder="좌석 (선택, 예: 5호차 12A)"
              placeholderTextColor={C.sub}
            />
            <Btn title="예매 완료로 표시" onPress={() => store.markBooked(plan.id, seat)} />
          </Card>

          <Card title="표가 없나요?">
            <Btn
              kind="plain"
              title="매진 — 차선 열차 보기"
              onPress={async () => {
                setLoadingAlts(true);
                setAlts(await store.markSoldOut(plan.id));
                setLoadingAlts(false);
              }}
            />
            {loadingAlts ? <ActivityIndicator /> : null}
            {alts.map((t) => (
              <TrainRow
                key={t.trainNo}
                train={t}
                badge="차선"
                onPress={async () => {
                  await store.switchTrain(plan.id, t);
                  setAlts([]);
                }}
              />
            ))}
            {alts.length > 0 ? <Text style={{ color: C.sub, fontSize: 13 }}>눌러서 이 열차로 바꾸세요.</Text> : null}
          </Card>
        </>
      )}

      {!canSyncDirectly && (
        <Card title="캘린더">
          <Btn kind="plain" title="아이폰 캘린더에 추가" onPress={() => shareICS([plan])} />
          <Text style={{ color: C.sub, fontSize: 13 }}>
            Expo Go에서는 캘린더 자동 연동이 안 돼서 파일로 추가합니다. 정식 빌드에서는 자동으로 들어갑니다.
          </Text>
        </Card>
      )}

      <View style={{ marginHorizontal: 16, marginTop: 20 }}>
        <Btn
          kind="danger"
          title="일정 삭제"
          onPress={() =>
            Alert.alert('일정을 삭제할까요?', undefined, [
              { text: '취소', style: 'cancel' },
              {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                  await store.remove(plan.id);
                  onClose();
                },
              },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}
