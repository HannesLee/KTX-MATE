import Foundation

/// 승차일로부터 예매 오픈 일시를 계산한다.
///
/// 평상시 규칙: 승차일 1개월 전 같은 날 07:00(KST).
/// 전월에 같은 날짜가 없으면(예: 3/31 → 2/31) 전월 말일로 맞춘다.
/// 명절 특별예매처럼 예외가 있는 날은 `overrides` 로 덮어쓴다.
/// 실제 규칙은 코레일 공지로 확인 후 원격 설정으로 바꿀 수 있게 하는 것을 권장.
struct OpeningRule: Sendable {
    var monthsBefore: Int = 1
    var openHour: Int = 7
    var openMinute: Int = 0
    /// 승차일(yyyy-MM-dd) → 오픈 일시 예외
    var overrides: [String: Date] = [:]

    static let standard = OpeningRule()

    static var koreaCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Seoul")!
        cal.locale = Locale(identifier: "ko_KR")
        return cal
    }

    func openDate(forTravelDate travelDate: Date, calendar: Calendar = OpeningRule.koreaCalendar) -> Date {
        let key = Self.dayKey(travelDate, calendar: calendar)
        if let override = overrides[key] { return override }

        let travelDay = calendar.startOfDay(for: travelDate)
        // Calendar 는 존재하지 않는 날짜를 전월 말일로 맞춰 준다.
        let base = calendar.date(byAdding: .month, value: -monthsBefore, to: travelDay)!
        return calendar.date(bySettingHour: openHour, minute: openMinute, second: 0, of: base)!
    }

    static func dayKey(_ date: Date, calendar: Calendar = OpeningRule.koreaCalendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }
}
