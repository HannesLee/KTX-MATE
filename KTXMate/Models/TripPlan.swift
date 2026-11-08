import Foundation
import SwiftData

/// 예매 상태. 달력에서 색으로 표시된다.
enum TicketStatus: String, Codable, CaseIterable, Sendable {
    case waitingForOpen   // 오픈 전 (아직 살 수 없음)
    case openNotBooked    // 오픈됐는데 아직 안 삼 → 알림 대상
    case booked           // 예매 완료
    case needsAlternative // 매진 등으로 차선책 필요

    var label: String {
        switch self {
        case .waitingForOpen: "오픈 대기"
        case .openNotBooked: "예매 필요"
        case .booked: "예매 완료"
        case .needsAlternative: "차선 필요"
        }
    }
}

/// 사용자가 등록한 "이 날 이 시간쯤 기차표가 필요하다" 하나.
@Model
final class TripPlan {
    var id: UUID
    var travelDate: Date            // 승차일 (자정 기준 날짜)
    var preferredMinutes: Int       // 희망 출발 시각, 자정부터 분 (07:00 → 420)
    var fromStationID: String
    var fromStationName: String
    var toStationID: String
    var toStationName: String
    var statusRaw: String
    var openAt: Date                // 예매 오픈 일시

    // 선택된 열차 (사용자가 추천에서 고른 것)
    var chosenTrainNo: String?
    var chosenGrade: String?
    var chosenDeparture: Date?
    var chosenArrival: Date?

    // 예매 완료 후 정보
    var seatInfo: String?           // 예: "5호차 12A"

    var calendarEventID: String?    // EventKit 이벤트 식별자
    var seriesID: UUID?             // "매주 월요일" 처럼 한 번에 만든 묶음
    var createdAt: Date

    init(travelDate: Date,
         preferredMinutes: Int,
         from: Station,
         to: Station,
         openAt: Date,
         seriesID: UUID? = nil) {
        self.id = UUID()
        self.travelDate = travelDate
        self.preferredMinutes = preferredMinutes
        self.fromStationID = from.id
        self.fromStationName = from.name
        self.toStationID = to.id
        self.toStationName = to.name
        self.openAt = openAt
        self.statusRaw = TicketStatus.waitingForOpen.rawValue
        self.seriesID = seriesID
        self.createdAt = .now
    }

    var status: TicketStatus {
        get { TicketStatus(rawValue: statusRaw) ?? .waitingForOpen }
        set { statusRaw = newValue.rawValue }
    }

    var from: Station { Station(id: fromStationID, name: fromStationName) }
    var to: Station { Station(id: toStationID, name: toStationName) }

    func choose(_ train: TrainCandidate) {
        chosenTrainNo = train.trainNo
        chosenGrade = train.gradeName
        chosenDeparture = train.departure
        chosenArrival = train.arrival
    }

    /// 현재 시각 기준으로 상태를 갱신한다. (예매 완료/차선 필요는 유지)
    func refreshStatus(now: Date = .now) {
        guard status == .waitingForOpen || status == .openNotBooked else { return }
        status = now >= openAt ? .openNotBooked : .waitingForOpen
    }
}
