import Foundation
import UserNotifications

/// 예매 오픈 전 알림. 예매가 끝나면 남은 알림을 지운다.
///
/// iOS 는 앱당 대기 중인 로컬 알림이 64개로 제한되므로,
/// 가까운 일정부터 `maxPending` 개만 걸고 앱이 열릴 때마다 다시 채운다.
struct NotificationScheduler {
    var center: UNUserNotificationCenter = .current()
    /// 오픈 시각 기준 알림 오프셋(초). 하루 전, 10분 전, 정각.
    var offsets: [TimeInterval] = [-24 * 60 * 60, -10 * 60, 0]
    var maxPending = 60

    static let categoryID = "KTX_OPEN"
    static let openKorailAction = "OPEN_KORAIL"

    func requestAuthorization() async throws -> Bool {
        try await center.requestAuthorization(options: [.alert, .sound, .badge, .timeSensitive])
    }

    func registerCategories() {
        let open = UNNotificationAction(identifier: Self.openKorailAction,
                                        title: "코레일+ 열기",
                                        options: [.foreground])
        let category = UNNotificationCategory(identifier: Self.categoryID,
                                              actions: [open], intentIdentifiers: [])
        center.setNotificationCategories([category])
    }

    /// 모든 계획을 보고 알림을 다시 건다.
    func reschedule(plans: [TripPlan], now: Date = .now) async {
        center.removeAllPendingNotificationRequests()
        let requests = Self.requests(for: plans, offsets: offsets, now: now)
            .prefix(maxPending)
        for request in requests {
            try? await center.add(request)
        }
    }

    /// 순수 함수: 어떤 알림을 걸지 계산한다 (테스트 가능).
    static func requests(for plans: [TripPlan], offsets: [TimeInterval], now: Date) -> [UNNotificationRequest] {
        var items: [(Date, UNNotificationRequest)] = []
        for plan in plans where plan.status == .waitingForOpen || plan.status == .openNotBooked {
            for offset in offsets {
                let fire = plan.openAt.addingTimeInterval(offset)
                guard fire > now else { continue }
                let content = UNMutableNotificationContent()
                content.title = offset == 0 ? "지금 예매 오픈!" : "곧 예매 오픈"
                content.body = body(for: plan, offset: offset)
                content.sound = .default
                content.categoryIdentifier = categoryID
                content.interruptionLevel = offset == 0 ? .timeSensitive : .active
                content.userInfo = ["planID": plan.id.uuidString]

                let comps = OpeningRule.koreaCalendar.dateComponents(
                    in: OpeningRule.koreaCalendar.timeZone, from: fire)
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                let id = "\(plan.id.uuidString)-\(Int(offset))"
                items.append((fire, UNNotificationRequest(identifier: id, content: content, trigger: trigger)))
            }
        }
        return items.sorted { $0.0 < $1.0 }.map(\.1)
    }

    static func body(for plan: TripPlan, offset: TimeInterval) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.timeZone = OpeningRule.koreaCalendar.timeZone
        f.dateFormat = "M/d(E)"
        let route = "\(plan.fromStationName)→\(plan.toStationName)"
        let train = plan.chosenTrainNo.map { " \(plan.chosenGrade ?? "KTX") \($0)" } ?? ""
        let when: String
        switch offset {
        case 0: when = "지금"
        case -10 * 60: when = "10분 뒤"
        default: when = "내일 같은 시각"
        }
        return "\(f.string(from: plan.travelDate)) \(route)\(train) 승차권이 \(when) 열립니다."
    }
}
