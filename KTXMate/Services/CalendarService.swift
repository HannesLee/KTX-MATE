import EventKit
import Foundation

/// 캘린더 연동 추상화. 애플 캘린더 외 구글 등은 이 프로토콜을 구현해 추가한다.
protocol CalendarProviding {
    func requestAccess() async throws -> Bool
    /// 이벤트를 만들거나 갱신하고 식별자를 돌려준다.
    func upsertEvent(for plan: TripPlan) throws -> String
    func removeEvent(id: String) throws
}

/// EventKit 기반 애플 캘린더 연동. "KTX MATE" 전용 캘린더에 일정을 넣는다.
final class AppleCalendarService: CalendarProviding {
    private let store = EKEventStore()
    private let calendarTitle = "KTX MATE"

    func requestAccess() async throws -> Bool {
        try await store.requestFullAccessToEvents()
    }

    func upsertEvent(for plan: TripPlan) throws -> String {
        let event = plan.calendarEventID.flatMap { store.event(withIdentifier: $0) }
            ?? EKEvent(eventStore: store)
        event.calendar = try ktxCalendar()

        let start = plan.chosenDeparture
            ?? TrainRecommender.preferredDate(travelDate: plan.travelDate, minutes: plan.preferredMinutes)
        let end = plan.chosenArrival ?? start.addingTimeInterval(2 * 60 * 60)
        event.startDate = start
        event.endDate = end
        event.title = Self.title(for: plan)
        event.notes = Self.notes(for: plan)
        event.location = "\(plan.fromStationName)역"

        try store.save(event, span: .thisEvent, commit: true)
        return event.eventIdentifier
    }

    func removeEvent(id: String) throws {
        guard let event = store.event(withIdentifier: id) else { return }
        try store.remove(event, span: .thisEvent, commit: true)
    }

    static func title(for plan: TripPlan) -> String {
        let route = "\(plan.fromStationName)→\(plan.toStationName)"
        let train = plan.chosenTrainNo.map { " \(plan.chosenGrade ?? "KTX") \($0)" } ?? ""
        switch plan.status {
        case .booked: return "🚄 \(route)\(train)"
        case .needsAlternative: return "⚠️ (차선 필요) \(route)\(train)"
        default: return "⏳ (미예매) \(route)\(train)"
        }
    }

    static func notes(for plan: TripPlan) -> String {
        var lines = ["상태: \(plan.status.label)"]
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.timeZone = OpeningRule.koreaCalendar.timeZone
        f.dateFormat = "M월 d일(E) HH:mm"
        lines.append("예매 오픈: \(f.string(from: plan.openAt))")
        if let seat = plan.seatInfo { lines.append("좌석: \(seat)") }
        lines.append("KTX MATE에서 관리하는 일정입니다.")
        return lines.joined(separator: "\n")
    }

    private func ktxCalendar() throws -> EKCalendar {
        if let existing = store.calendars(for: .event).first(where: { $0.title == calendarTitle }) {
            return existing
        }
        let cal = EKCalendar(for: .event, eventStore: store)
        cal.title = calendarTitle
        cal.cgColor = CGColor(red: 0.0, green: 0.36, blue: 0.67, alpha: 1)
        cal.source = store.defaultCalendarForNewEvents?.source
            ?? store.sources.first(where: { $0.sourceType == .local })
        try store.saveCalendar(cal, commit: true)
        return cal
    }
}
