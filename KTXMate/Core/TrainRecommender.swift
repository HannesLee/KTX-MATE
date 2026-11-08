import Foundation

/// 시간표에서 희망 시각에 가장 맞는 열차와 차선책을 고른다.
struct TrainRecommender: Sendable {
    /// KTX 가 아닌 열차에 붙이는 감점(분 단위로 환산)
    var nonKTXPenaltyMinutes: Double = 60
    /// 소요시간이 가장 빠른 열차보다 1분 느릴 때마다 붙는 감점
    var slowerPenaltyPerMinute: Double = 0.5
    /// 희망 시각보다 이른 출발에 대한 가중치 (늦는 것보다 일찍 가는 게 낫다면 1보다 작게)
    var earlyWeight: Double = 0.8
    /// 희망 시각과 이만큼(분) 넘게 차이 나면 후보에서 뺀다
    var maxDeviationMinutes: Double = 180

    struct Recommendation: Sendable {
        let best: TrainCandidate?
        let alternatives: [TrainCandidate]
    }

    func score(_ train: TrainCandidate, preferred: Date, fastestDuration: TimeInterval) -> Double {
        let diff = train.departure.timeIntervalSince(preferred) / 60
        let deviation = diff < 0 ? -diff * earlyWeight : diff
        let slower = max(0, (train.duration - fastestDuration) / 60) * slowerPenaltyPerMinute
        let grade = train.isKTX ? 0 : nonKTXPenaltyMinutes
        return deviation + slower + grade
    }

    /// - Parameters:
    ///   - excluding: 매진 등으로 뺄 열차번호
    ///   - alternativeCount: 차선책 개수
    func recommend(from trains: [TrainCandidate],
                   preferred: Date,
                   excluding: Set<String> = [],
                   alternativeCount: Int = 3) -> Recommendation {
        let pool = trains.filter {
            !excluding.contains($0.trainNo)
                && abs($0.departure.timeIntervalSince(preferred)) / 60 <= maxDeviationMinutes
        }
        guard let fastest = pool.map(\.duration).min() else {
            return Recommendation(best: nil, alternatives: [])
        }
        let ranked = pool.sorted {
            score($0, preferred: preferred, fastestDuration: fastest)
                < score($1, preferred: preferred, fastestDuration: fastest)
        }
        return Recommendation(best: ranked.first,
                              alternatives: Array(ranked.dropFirst().prefix(alternativeCount)))
    }

    /// 승차일 + 희망 분(자정 기준) → Date
    static func preferredDate(travelDate: Date, minutes: Int,
                              calendar: Calendar = OpeningRule.koreaCalendar) -> Date {
        let day = calendar.startOfDay(for: travelDate)
        return calendar.date(byAdding: .minute, value: minutes, to: day)!
    }
}
