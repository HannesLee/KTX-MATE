import SwiftData
import SwiftUI

extension TicketStatus {
    var color: Color {
        switch self {
        case .waitingForOpen: .gray
        case .openNotBooked: .orange
        case .booked: .blue
        case .needsAlternative: .red
        }
    }
}

/// 메인 화면: 월간 달력 + 선택한 날의 일정 목록
struct PlanCalendarView: View {
    @Environment(PlanService.self) private var service
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @Query(sort: \TripPlan.travelDate) private var plans: [TripPlan]

    @State private var month = Date.now
    @State private var selectedDay = OpeningRule.koreaCalendar.startOfDay(for: .now)
    @State private var showingAdd = false

    private let cal = OpeningRule.koreaCalendar

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                monthHeader
                MonthGrid(month: month, selectedDay: $selectedDay, statuses: statusesByDay)
                    .padding(.horizontal, 16)
                legend
                List {
                    let dayPlans = plans.filter { cal.isDate($0.travelDate, inSameDayAs: selectedDay) }
                    if dayPlans.isEmpty {
                        Text("이 날 등록된 기차표가 없습니다").foregroundStyle(.secondary)
                    }
                    ForEach(dayPlans) { plan in
                        NavigationLink { PlanDetailView(plan: plan) } label: { PlanRow(plan: plan) }
                    }
                    upcomingOpens
                }
                .listStyle(.insetGrouped)
            }
            .navigationTitle("KTX MATE")
            .toolbar {
                Button { showingAdd = true } label: { Image(systemName: "plus") }
            }
            .sheet(isPresented: $showingAdd) { AddPlanView(initialDate: selectedDay) }
            .alert("알림", isPresented: .constant(service.lastError != nil)) {
                Button("확인") { service.lastError = nil }
            } message: { Text(service.lastError ?? "") }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { Task { await service.refreshAll(in: context) } }
            }
        }
    }

    private var statusesByDay: [String: [TicketStatus]] {
        Dictionary(grouping: plans, by: { OpeningRule.dayKey($0.travelDate) })
            .mapValues { $0.map(\.status) }
    }

    private var monthHeader: some View {
        HStack {
            Button { month = cal.date(byAdding: .month, value: -1, to: month)! } label: { Image(systemName: "chevron.left") }
            Spacer()
            Text(month, format: .dateTime.year().month(.wide)).font(.headline)
            Spacer()
            Button { month = cal.date(byAdding: .month, value: 1, to: month)! } label: { Image(systemName: "chevron.right") }
        }
        .padding(.horizontal, 16)
    }

    private var legend: some View {
        HStack(spacing: 12) {
            ForEach(TicketStatus.allCases, id: \.self) { s in
                Label(s.label, systemImage: "circle.fill")
                    .labelStyle(.titleAndIcon)
                    .font(.caption2)
                    .foregroundStyle(s.color)
            }
        }
    }

    @ViewBuilder private var upcomingOpens: some View {
        let soon = plans.filter { $0.status == .waitingForOpen && $0.openAt > .now }.prefix(5)
        if !soon.isEmpty {
            Section("다가오는 예매 오픈") {
                ForEach(Array(soon)) { plan in
                    HStack {
                        Text(plan.openAt, format: .dateTime.month().day().hour().minute())
                        Spacer()
                        Text("\(plan.travelDate.formatted(.dateTime.month().day())) \(plan.fromStationName)→\(plan.toStationName)")
                            .foregroundStyle(.secondary)
                    }
                    .font(.subheadline)
                }
            }
        }
    }
}

struct PlanRow: View {
    let plan: TripPlan
    var body: some View {
        HStack {
            Circle().fill(plan.status.color).frame(width: 10, height: 10)
            VStack(alignment: .leading) {
                Text("\(plan.fromStationName) → \(plan.toStationName)").font(.headline)
                if let dep = plan.chosenDeparture, let no = plan.chosenTrainNo {
                    Text("\(dep.formatted(date: .omitted, time: .shortened)) \(plan.chosenGrade ?? "") \(no)")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(plan.status.label).font(.caption).foregroundStyle(plan.status.color)
        }
    }
}

/// 간단한 월간 그리드. 날짜 아래 점 색으로 예매 상태 표시.
struct MonthGrid: View {
    let month: Date
    @Binding var selectedDay: Date
    let statuses: [String: [TicketStatus]]
    private let cal = OpeningRule.koreaCalendar
    private let columns = Array(repeating: GridItem(.flexible()), count: 7)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(["일", "월", "화", "수", "목", "금", "토"], id: \.self) {
                Text($0).font(.caption).foregroundStyle(.secondary)
            }
            ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                if let day {
                    dayCell(day)
                } else {
                    Color.clear.frame(height: 40)
                }
            }
        }
    }

    private func dayCell(_ day: Date) -> some View {
        let selected = cal.isDate(day, inSameDayAs: selectedDay)
        let dayStatuses = statuses[OpeningRule.dayKey(day)] ?? []
        return Button { selectedDay = day } label: {
            VStack(spacing: 2) {
                Text("\(cal.component(.day, from: day))")
                    .font(.body)
                    .fontWeight(cal.isDateInToday(day) ? .bold : .regular)
                HStack(spacing: 2) {
                    ForEach(Array(dayStatuses.prefix(3).enumerated()), id: \.offset) { _, s in
                        Circle().fill(s.color).frame(width: 5, height: 5)
                    }
                }
                .frame(height: 5)
            }
            .frame(maxWidth: .infinity, minHeight: 40)
            .background(selected ? Color.accentColor.opacity(0.15) : .clear, in: .rect(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    private var days: [Date?] {
        let interval = cal.dateInterval(of: .month, for: month)!
        let leading = cal.component(.weekday, from: interval.start) - 1
        let count = cal.range(of: .day, in: .month, for: month)!.count
        let dates = (0..<count).map { cal.date(byAdding: .day, value: $0, to: interval.start)! }
        return Array(repeating: nil, count: leading) + dates.map { Optional($0) }
    }
}
