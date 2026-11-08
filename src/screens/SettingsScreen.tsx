import React, { useState } from 'react';
import { Linking, ScrollView, Text, TextInput } from 'react-native';
import { Btn, C, Card, s } from '../components/ui';
import { canSyncDirectly, shareICS } from '../services/calendarSync';
import { useStore } from '../store';

export function SettingsScreen({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const [key, setKey] = useState(store.settings.tagoKey);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Card title="열차 시간표 인증키 (공공데이터포털)">
        <TextInput
          style={s.input}
          value={key}
          onChangeText={setKey}
          placeholder="일반 인증키(Decoding)를 붙여넣기"
          placeholderTextColor={C.sub}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Btn
          title="저장"
          onPress={async () => {
            await store.updateSettings({ ...store.settings, tagoKey: key.trim() });
            onDone();
          }}
        />
        <Btn
          kind="plain"
          title="인증키 발급받으러 가기"
          onPress={() => Linking.openURL('https://www.data.go.kr/data/15098552/openapi.do')}
        />
        <Text style={{ color: C.sub, fontSize: 13 }}>
          회원가입 → "활용신청" → 마이페이지에서 일반 인증키(Decoding)를 복사해 붙여넣으세요. 무료입니다.
        </Text>
      </Card>

      {!canSyncDirectly && store.plans.length > 0 && (
        <Card title="캘린더">
          <Btn kind="plain" title={`전체 일정 ${store.plans.length}개를 캘린더에 추가`} onPress={() => shareICS(store.plans)} />
        </Card>
      )}
    </ScrollView>
  );
}
