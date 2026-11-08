import Foundation

/// 시간표에서 가져온 열차 한 편.
struct TrainCandidate: Hashable, Codable, Identifiable, Sendable {
    var id: String { "\(trainNo)-\(Int(departure.timeIntervalSince1970))" }

    let trainNo: String          // 열차번호, 예: "101"
    let gradeName: String        // 예: "KTX", "KTX-산천", "ITX-새마을"
    let departure: Date
    let arrival: Date
    let fromName: String
    let toName: String
    let adultFare: Int?

    var isKTX: Bool { gradeName.uppercased().contains("KTX") }
    var duration: TimeInterval { arrival.timeIntervalSince(departure) }
}
