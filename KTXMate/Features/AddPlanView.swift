import SwiftData
import SwiftUI

/// 일정 등록: 말로 등록(온디바이스 AI) 또는 폼 입력 → 추천 확인 → 저장
struct AddPlanView: View {
    @Environment(PlanService.self) private var service
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    let initialDate: Date

    enum Mode: String, CaseIterable { case single = "하루", thisMonth = "이번 달", nextMonth = "다음 달" }

    @State private var utterance = ""
    @State private var parsing = false
    @State private var mode: Mode = .single
    @State private var date = Date.now
    @State private var weekdays: Set<Int> = []
    @State private var time = OpeningRule.koreaCalendar.date(bySettingHour: 7, minute: 0, second: 0, of: .now)!
    @State private var from: Station = .seoul
    @State private var to: Station = .busan

    @State private var preview: TrainRecommender.Recommendation?
    @State private var loading = false

    private let cal = OpeningRule.koreaCalendar
    private let weekdayNames = [(2, "월"), (3, "화"), (4, "수"), (5, "목"), (6, "금"), (7, "토"), (1, "일")]

    var body: some View {
        NavigationStack {
            Form {
                if PlanIntentParser.isAvailable {
                    Section("말로 등록") {
                        TextField("예: 이번달 매주 월요일 7시 서울에서 부산", text: $utterance, axis: .vertical)
                        Button(parsing ? "이해하는 중…" : "입력 채우기") { Task { await parse() } }
                            .disabled(utterance.isEmpty || parsing)
                    }
                }
                Section("구간") {
                    Picker("출발", selection: $from) { ForEach(Station.presets) { Text($0.name).tag($0) } }
                    Picker("도착", selection: $to) { ForEach(Station.presets) { Text($0.name).tag($0) } }
                }
                Section("날짜") {
                    Picker("기간", selection: $mode) { ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) } }
                        .pickerStyle(.segmented)
                    if mode == .single {
                        DatePicker("승차일", selection: $date, in: Date.now..., displayedComponents: .date)
                    } else {
                        HStack {
                            ForEach(weekdayNames, id: \.0) { wd, name in
                                Toggle(name, isOn: Binding(
                                    get: { weekdays.contains(wd) },
                                    set: { if $0 { weekdays.insert(wd) } else { weekdays.remove(wd) } }))
                                .toggleStyle(.button)
                            }
                        }
                        Text("\(dates.count)일 선택됨").font(.caption).foregroundStyle(.secondary)
                    }
                    DatePicker("희망 출발", selection: $time, displayedComponents: .hourAndMinute)
                }
                Section("추천 열차 (\(firstDateLabel))") {
                    if loading { ProgressView() }
                    else if let preview {
                        if let best = preview.best {
                            TrainLine(train: best, badge: "추천")
                            ForEach(preview.alternatives) { TrainLine(train: $0, badge: "차선") }
                        } else {
                            Text("조건에 맞는 열차가 없습니다").foregroundStyle(.secondary)
                        }
                    } else {
                        Button("추천 보기") { Task { await loadPreview() } }
                    }
                    if let first = dates.first {
                        Text("예매 오픈: \(service.openingRule.openDate(forTravelDate: first).formatted(.dateTime.month().day().hour().minute()))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("기차표 일정 등록")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("확인") { Task { await save() } }.disabled(dates.isEmpty || from == to)
                }
            }
            .onAppear { date = initialDate }
            .onChange(of: [from.id, to.id]) { preview = nil }
            .onChange(of: time) { preview = nil }
        }
    }

    private var preferredMinutes: Int {
        cal.component(.hour, from: time) * 60 + cal.component(.minute, from: time)
    }

    private var dates: [Date] {
        let period: RecurrenceRequest.Period = switch mode {
        case .single: .single(date)
        case .thisMonth: .thisMonth
        case .nextMonth: .nextMonth
        }
        return RecurrenceExpander.dates(for: RecurrenceRequest(period: period, weekdays: weekdays))
    }

    private var firstDateLabel: String {
        dates.first.map { $0.formatted(.dateTime.month().day().weekday()) } ?? "-"
    }

    private func loadPreview() async {
        guard let first = dates.first else { return }
        loading = true
        preview = await service.recommend(from: from, to: to, date: first, preferredMinutes: preferredMinutes)
        loading = false
    }

    private func save() async {
        _ = await service.createPlans(dates: dates, from: from, to: to,
                                      preferredMinutes: preferredMinutes, in: context)
        dismiss()
    }

    private func parse() async {
        parsing = true
        defer { parsing = false }
        guard let intent = try? await PlanIntentParser.parse(utterance) else {
            service.lastError = "문장을 이해하지 못했습니다. 아래 입력란을 직접 채워 주세요."
            return
        }
        if let f = intent.from { from = f }
        if let t = intent.to { to = t }
        if let m = intent.preferredMinutes {
            time = cal.date(bySettingHour: m / 60, minute: m % 60, second: 0, of: .now)!
        }
        weekdays = intent.request.weekdays
        switch intent.request.period {
        case .single(let d): mode = .single; date = d
        case .nextMonth: mode = .nextMonth
        default: mode = .thisMonth
        }
        await loadPreview()
    }
}

struct TrainLine: View {
    let train: TrainCandidate
    var badge: String?
    var body: some View {
        HStack {
            if let badge {
                Text(badge).font(.caption2).padding(.horizontal, 6).padding(.vertical, 2)
                    .background(badge == "추천" ? Color.blue.opacity(0.15) : Color.gray.opacity(0.15), in: .capsule)
            }
            Text("\(train.departure.formatted(date: .omitted, time: .shortened)) → \(train.arrival.formatted(date: .omitted, time: .shortened))")
            Spacer()
            Text("\(train.gradeName) \(train.trainNo)").foregroundStyle(.secondary)
        }
        .font(.subheadline)
    }
}
