import Foundation
import SwiftData

/// 일정 생성 → 추천 → 캘린더 → 알림 흐름을 묶는 곳.
@MainActor
@Observable
final class PlanService {
    let timetable: TrainTimetableProviding
    let calendar: CalendarProviding
    let notifications: NotificationScheduler
    var openingRule: OpeningRule
    let recommender = TrainRecommender()

    var lastError: String?

    init(timetable: TrainTimetableProviding = TagoTrainClient.fromBundle(),
         calendar: CalendarProviding = AppleCalendarService(),
         notifications: NotificationScheduler = NotificationScheduler(),
         openingRule: OpeningRule = .standard) {
        self.timetable = timetable
        self.calendar = calendar
        self.notifications = notifications
        self.openingRule = openingRule
    }

    func bootstrap() async {
        notifications.registerCategories()
        _ = try? await notifications.requestAuthorization()
        _ = try? await calendar.requestAccess()
    }

    /// 한 날짜에 대한 추천 (best + 차선)
    func recommend(from: Station, to: Station, date: Date, preferredMinutes: Int,
                   excluding: Set<String> = []) async -> TrainRecommender.Recommendation {
        do {
            let trains = try await timetable.trains(from: from, to: to, on: date)
            let preferred = TrainRecommender.preferredDate(travelDate: date, minutes: preferredMinutes)
            return recommender.recommend(from: trains, preferred: preferred, excluding: excluding)
        } catch {
            lastError = "시간표를 가져오지 못했습니다: \(error.localizedDescription)"
            return .init(best: nil, alternatives: [])
        }
    }

    /// 날짜들에 대해 계획을 만들고, 날짜마다 추천 1순위를 골라 둔다.
    func createPlans(dates: [Date], from: Station, to: Station, preferredMinutes: Int,
                     in context: ModelContext) async -> [TripPlan] {
        let seriesID = dates.count > 1 ? UUID() : nil
        var created: [TripPlan] = []
        for date in dates {
            let plan = TripPlan(travelDate: date, preferredMinutes: preferredMinutes,
                                from: from, to: to,
                                openAt: openingRule.openDate(forTravelDate: date),
                                seriesID: seriesID)
            if let best = await recommend(from: from, to: to, date: date,
                                          preferredMinutes: preferredMinutes).best {
                plan.choose(best)
            }
            plan.refreshStatus()
            context.insert(plan)
            syncCalendar(plan)
            created.append(plan)
        }
        try? context.save()
        await rescheduleNotifications(in: context)
        return created
    }

    func markBooked(_ plan: TripPlan, ticketText: String?, in context: ModelContext) async {
        if let text = ticketText {
            let parsed = TicketTextParser.parse(text)
            if let no = parsed.trainNo { plan.chosenTrainNo = no }
            if let seat = parsed.seat { plan.seatInfo = seat }
        }
        plan.status = .booked
        syncCalendar(plan)
        try? context.save()
        await rescheduleNotifications(in: context)
    }

    /// 매진 표시 → 차선책을 돌려준다.
    func markSoldOut(_ plan: TripPlan, in context: ModelContext) async -> [TrainCandidate] {
        plan.status = .needsAlternative
        syncCalendar(plan)
        try? context.save()
        let excluded: Set<String> = plan.chosenTrainNo.map { [$0] } ?? []
        let rec = await recommend(from: plan.from, to: plan.to, date: plan.travelDate,
                                  preferredMinutes: plan.preferredMinutes, excluding: excluded)
        return [rec.best].compactMap { $0 } + rec.alternatives
    }

    func switchTrain(_ plan: TripPlan, to train: TrainCandidate, in context: ModelContext) async {
        plan.choose(train)
        plan.status = .openNotBooked
        plan.refreshStatus()
        syncCalendar(plan)
        try? context.save()
        await rescheduleNotifications(in: context)
    }

    func delete(_ plan: TripPlan, in context: ModelContext) async {
        if let id = plan.calendarEventID { try? calendar.removeEvent(id: id) }
        context.delete(plan)
        try? context.save()
        await rescheduleNotifications(in: context)
    }

    func refreshAll(in context: ModelContext) async {
        let plans = (try? context.fetch(FetchDescriptor<TripPlan>())) ?? []
        for plan in plans {
            let before = plan.status
            plan.refreshStatus()
            if plan.status != before { syncCalendar(plan) }
        }
        try? context.save()
        await rescheduleNotifications(in: context)
    }

    private func syncCalendar(_ plan: TripPlan) {
        do { plan.calendarEventID = try calendar.upsertEvent(for: plan) }
        catch { lastError = "캘린더에 저장하지 못했습니다: \(error.localizedDescription)" }
    }

    private func rescheduleNotifications(in context: ModelContext) async {
        let plans = (try? context.fetch(FetchDescriptor<TripPlan>())) ?? []
        await notifications.reschedule(plans: plans)
    }
}
