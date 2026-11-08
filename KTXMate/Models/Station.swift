import Foundation

/// TAGO 열차정보 API에서 쓰는 역 코드.
/// 전체 목록은 `TagoTrainClient.fetchStations(cityCode:)` 로 받아올 수 있으며,
/// 아래는 자주 쓰는 역만 미리 넣어 둔 것이다. (코드는 실제 API 응답으로 한 번 검증 필요)
struct Station: Hashable, Codable, Identifiable, Sendable {
    let id: String      // 예: "NAT010000"
    let name: String    // 예: "서울"

    static let seoul    = Station(id: "NAT010000", name: "서울")
    static let yongsan  = Station(id: "NAT010032", name: "용산")
    static let gwangmyeong = Station(id: "NAT010415", name: "광명")
    static let osong    = Station(id: "NAT050044", name: "오송")
    static let daejeon  = Station(id: "NAT011668", name: "대전")
    static let dongdaegu = Station(id: "NAT013271", name: "동대구")
    static let busan    = Station(id: "NAT014445", name: "부산")

    static let presets: [Station] = [.seoul, .yongsan, .gwangmyeong, .osong, .daejeon, .dongdaegu, .busan]

    static func named(_ name: String) -> Station? {
        let trimmed = name.replacingOccurrences(of: "역", with: "").trimmingCharacters(in: .whitespaces)
        return presets.first { $0.name == trimmed }
    }
}
