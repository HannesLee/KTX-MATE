import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// "이번달 매주 월요일 7시 서울에서 부산 티켓 구매해줘" → 구조화된 요청 (2단계 기능).
/// Apple Intelligence 온디바이스 모델을 쓰고, 쓸 수 없는 기기는 폼 입력으로 대체한다.
struct PlanIntent: Equatable, Sendable {
    var request: RecurrenceRequest
    var preferredMinutes: Int?
    var from: Station?
    var to: Station?
}

#if canImport(FoundationModels)
@Generable
struct GeneratedPlanIntent {
    @Guide(description: "기간. thisMonth, nextMonth, single, range 중 하나")
    var period: String
    @Guide(description: "single 이면 그 날짜, range 면 시작일. yyyy-MM-dd. 없으면 빈 문자열")
    var startDate: String
    @Guide(description: "range 의 종료일 yyyy-MM-dd. 없으면 빈 문자열")
    var endDate: String
    @Guide(description: "요일 목록. 월,화,수,목,금,토,일 중에서. 매일이면 빈 배열")
    var weekdays: [String]
    @Guide(description: "희망 출발 시각 HH:mm (24시간). '아침 7시'는 07:00, '저녁 7시'는 19:00. 없으면 빈 문자열")
    var time: String
    @Guide(description: "출발역 이름. 없으면 빈 문자열")
    var from: String
    @Guide(description: "도착역 이름. 없으면 빈 문자열")
    var to: String
}
#endif

enum PlanIntentParser {
    static var isAvailable: Bool {
        #if canImport(FoundationModels)
        return SystemLanguageModel.default.isAvailable
        #else
        return false
        #endif
    }

    static func parse(_ utterance: String, now: Date = .now) async throws -> PlanIntent? {
        #if canImport(FoundationModels)
        guard isAvailable else { return nil }
        let session = LanguageModelSession(instructions: """
            너는 기차표 예매 일정을 구조화하는 도우미다. 오늘은 \(OpeningRule.dayKey(now))이다.
            사용자 문장에서 기간, 요일, 희망 출발 시각, 출발역, 도착역을 뽑아라.
            """)
        let response = try await session.respond(to: utterance, generating: GeneratedPlanIntent.self)
        return map(response.content)
        #else
        return nil
        #endif
    }

    #if canImport(FoundationModels)
    static func map(_ g: GeneratedPlanIntent) -> PlanIntent {
        let period: RecurrenceRequest.Period
        switch g.period {
        case "nextMonth": period = .nextMonth
        case "single": period = date(g.startDate).map { .single($0) } ?? .thisMonth
        case "range":
            if let s = date(g.startDate), let e = date(g.endDate) { period = .range(from: s, to: e) }
            else { period = .thisMonth }
        default: period = .thisMonth
        }
        return PlanIntent(request: RecurrenceRequest(period: period, weekdays: weekdays(g.weekdays)),
                          preferredMinutes: minutes(g.time),
                          from: Station.named(g.from),
                          to: Station.named(g.to))
    }
    #endif

    static func weekdays(_ names: [String]) -> Set<Int> {
        let map = ["일": 1, "월": 2, "화": 3, "수": 4, "목": 5, "금": 6, "토": 7]
        return Set(names.compactMap { map[String($0.prefix(1))] })
    }

    static func minutes(_ hhmm: String) -> Int? {
        let parts = hhmm.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, (0..<24).contains(parts[0]), (0..<60).contains(parts[1]) else { return nil }
        return parts[0] * 60 + parts[1]
    }

    static func date(_ s: String) -> Date? {
        let f = DateFormatter()
        f.calendar = OpeningRule.koreaCalendar
        f.timeZone = OpeningRule.koreaCalendar.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: s)
    }
}
