import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { C } from './src/components/ui';
import { dayKeyOf } from './src/core/time';
import { AddPlanScreen } from './src/screens/AddPlanScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { PlanDetailScreen } from './src/screens/PlanDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OPEN_KORAIL } from './src/services/notifications';
import { openKorail } from './src/services/handoff';
import { StoreProvider, useStore } from './src/store';

type Sheet = { kind: 'add' } | { kind: 'detail'; id: string } | { kind: 'settings' } | null;

function Main() {
  const store = useStore();
  const [sheet, setSheet] = useState<Sheet>(null);

  // 알림을 누르면 해당 일정 열기, "코레일+ 열기" 버튼이면 바로 코레일+
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const planId = res.notification.request.content.data?.planId as string | undefined;
      const plan = store.plans.find((p) => p.id === planId);
      if (res.actionIdentifier === OPEN_KORAIL) openKorail(plan);
      else if (planId) setSheet({ kind: 'detail', id: planId });
    });
    return () => sub.remove();
  }, [store.plans]);

  useEffect(() => {
    if (store.error) Alert.alert('알림', store.error, [{ text: '확인', onPress: store.clearError }]);
  }, [store.error]);

  useEffect(() => {
    if (store.ready && !store.settings.tagoKey) setSheet({ kind: 'settings' });
  }, [store.ready]);

  const title = sheet?.kind === 'add' ? '기차표 일정 등록' : sheet?.kind === 'settings' ? '설정' : '일정 상세';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <StatusBar style="dark" />
      <View style={st.header}>
        <Pressable onPress={() => setSheet({ kind: 'settings' })} hitSlop={10}>
          <Text style={st.headerBtn}>설정</Text>
        </Pressable>
        <Text style={st.title}>KTX MATE</Text>
        <Pressable onPress={() => setSheet({ kind: 'add' })} hitSlop={10}>
          <Text style={[st.headerBtn, { fontSize: 28 }]}>＋</Text>
        </Pressable>
      </View>

      <CalendarScreen onOpenPlan={(id) => setSheet({ kind: 'detail', id })} />

      <Modal visible={!!sheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={st.sheetHeader}>
            <Pressable onPress={() => setSheet(null)} hitSlop={10}>
              <Text style={st.headerBtn}>닫기</Text>
            </Pressable>
            <Text style={st.sheetTitle}>{title}</Text>
            <View style={{ width: 40 }} />
          </View>
          {sheet?.kind === 'add' && <AddPlanScreen initialDay={dayKeyOf(new Date())} onDone={() => setSheet(null)} />}
          {sheet?.kind === 'detail' && <PlanDetailScreen planId={sheet.id} onClose={() => setSheet(null)} />}
          {sheet?.kind === 'settings' && <SettingsScreen onDone={() => setSheet(null)} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Main />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  title: { fontSize: 20, fontWeight: '700', color: C.text },
  headerBtn: { fontSize: 16, color: C.accent },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: C.text },
});
