# KTX MATE

필요한 날짜를 말하면 예매 오픈일을 알려 주고, 오픈 시각에 맞춰 예매를 돕고, 달력에 티켓 현황을 표시해 주는 iOS 앱.

## 1단계 범위 (현재)

- 월간 달력에 날짜별 예매 상태 표시 (오픈 대기 / 예매 필요 / 예매 완료 / 차선 필요)
- 일정 등록: 하루, 또는 이번 달·다음 달의 특정 요일 반복
- 말로 등록: "이번달 매주 월요일 7시 서울에서 부산" (Apple Intelligence 지원 기기, iOS 26+)
- 공공데이터포털 TAGO 시간표로 희망 시각에 가장 맞는 열차 추천 + 차선 2~3개
- 예매 오픈일 계산 (평상시: 승차일 1개월 전 07:00, 명절 예외는 `OpeningRule.overrides`)
- 애플 캘린더의 "KTX MATE" 캘린더에 일정 등록, 상태에 따라 제목 갱신
- 오픈 하루 전 / 10분 전 / 정각 알림, 알림에서 바로 "코레일+ 열기"
- 예매 후 상세 화면에서 "예매 완료"를 직접 표시 (좌석은 선택 입력)
- 매진이면 같은 날 차선 열차 제안

자동 예약은 `ReservationProvider` 뒤에 분리되어 있고, 앱스토어 빌드에서는 아무것도 자동으로 하지 않습니다.
(코레일은 공개 예매 API가 없어 비공식 API는 약관·계정 제재 위험이 있으므로 3단계에서 개인용 빌드에만 붙일 예정)

## 시작하기

1. Mac에 Xcode 26 이상 설치
2. `brew install xcodegen` 후 저장소 폴더에서 `xcodegen` → `KTXMate.xcodeproj` 생성
3. [공공데이터포털 TAGO 열차정보](https://www.data.go.kr/data/15098552/openapi.do) 활용 신청 → 인증키(Decoding) 발급
4. `project.yml` 의 `TAGO_SERVICE_KEY` 에 키 입력 (공개 저장소라면 xcconfig 로 분리해 커밋하지 않기)
5. Xcode에서 Signing 팀 선택 후 실기기 실행. 테스트는 `⌘U`

## 구조

```
KTXMate/
  App/       앱 진입점, PlanService(등록→추천→캘린더→알림 흐름)
  Models/    TripPlan(SwiftData), TrainCandidate, Station
  Core/      OpeningRule, RecurrenceExpander, TrainRecommender  ← 순수 로직(안드로이드 이식 대상)
  Services/  TAGO 시간표, 애플 캘린더, 알림, 코레일+ 넘기기, 자연어 파싱, 자동예약 자리
  Features/  달력 / 등록 / 상세 화면
KTXMateTests/ 오픈일·반복·추천·파싱 단위 테스트
```

## 확인이 필요한 것

- 역 코드(`Station.presets`)는 TAGO 역 목록 API 응답으로 한 번 검증
- 코레일+ 앱 URL 스킴(`BookingHandoff.appURL`) 실제 값 확인. 확인 전에는 웹으로 넘어감
- 오픈 규칙은 코레일 공지 기준으로 최종 확인

## 다음 단계

- 2단계: 자연어 등록 다듬기, 공유 시트로 승차권 가져오기, 위젯/라이브 액티비티 오픈 카운트다운
- 3단계: 개인용 자동 예약 모듈, 구글 캘린더 연동
- 이후: 안드로이드 (Core 로직은 Kotlin Multiplatform 이식 고려)
