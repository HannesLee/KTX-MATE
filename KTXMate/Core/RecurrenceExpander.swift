import Foundation

/// "이번달 매주 월요일" 같은 요청을 실제 날짜 목록으로 펼친다.
struct RecurrenceRequest: Equatable, Sendable {
    enum Period: Equatable, Sendable {
        case thisMonth
        case nextMonth
        case range(from: Date, to: Date)
        case single(Date)
    }

    var period: Period
    /// 1 = 일요일 … 7 = 토요일 (Calendar.weekday 규칙). 비어 있으면 기간 내 모든 날.
    var weekdays: Set<Int> = []
}

enum RecurrenceExpander {
    static func dates(for request: RecurrenceRequest,
                      now: Date = .now,
                      includePast: Bool = false,
                      calendar: Calendar = OpeningRule.koreaCalendar) -> [Date] {
        let today = calendar.startOfDay(for: now)
        let (start, end): (Date, Date)

        switch request.period {
        case .single(let date):
            return [calendar.startOfDay(for: date)]
        case .thisMonth:
            let interval = calendar.dateInterval(of: .month, for: today)!
            start = interval.start
            end = calendar.date(byAdding: .day, value: -1, to: interval.end)!
        case .nextMonth:
            let next = calendar.date(byAdding: .month, value: 1, to: today)!
            let interval = calendar.dateInterval(of: .month, for: next)!
            start = interval.start
            end = calendar.date(byAdding: .day, value: -1, to: interval.end)!
        case .range(let from, let to):
            start = calendar.startOfDay(for: from)
            end = calendar.startOfDay(for: to)
        }

        var result: [Date] = []
        var day = start
        while day <= end {
            let weekday = calendar.component(.weekday, from: day)
            let matches = request.weekdays.isEmpty || request.weekdays.contains(weekday)
            if matches && (includePast || day >= today) {
                result.append(day)
            }
            day = calendar.date(byAdding: .day, value: 1, to: day)!
        }
        return result
    }
}
