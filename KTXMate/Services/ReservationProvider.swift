import Foundation

/// 자동 예약 모듈이 들어갈 자리 (3단계, 개인용).
///
/// 코레일은 공개 예매 API가 없어서 자동 예약은 비공식 API에 기대야 하며,
/// 약관 위반·계정 제재·앱스토어 반려 위험이 있다. 그래서:
/// - 앱스토어 빌드에는 `ManualReservationProvider`(아무것도 자동으로 하지 않음)만 넣고
/// - 개인용 빌드에서만 `PERSONAL_AUTOBOOK` 플래그로 실제 구현을 켠다.
/// 결제는 어느 경우에도 앱이 하지 않고, 사용자가 코레일+ 앱에서 기한 내 직접 결제한다.
protocol ReservationProvider: Sendable {
    var isAutomatic: Bool { get }
    /// 좌석을 잡아 두고(발권 전) 결과를 돌려준다.
    func reserve(train: TrainCandidate, from: Station, to: Station) async throws -> ReservationResult
    /// 매진 여부 확인. 확인할 수 없으면 nil.
    func isSoldOut(train: TrainCandidate, from: Station, to: Station) async throws -> Bool?
}

enum ReservationResult: Sendable {
    case reserved(seat: String?, payBy: Date?)
    case soldOut
    case notSupported
}

struct ManualReservationProvider: ReservationProvider {
    var isAutomatic: Bool { false }
    func reserve(train: TrainCandidate, from: Station, to: Station) async throws -> ReservationResult { .notSupported }
    func isSoldOut(train: TrainCandidate, from: Station, to: Station) async throws -> Bool? { nil }
}

enum ReservationProviders {
    static var current: ReservationProvider {
        #if PERSONAL_AUTOBOOK
        // TODO(3단계): 개인용 자동 예약 구현 연결
        return ManualReservationProvider()
        #else
        return ManualReservationProvider()
        #endif
    }
}
