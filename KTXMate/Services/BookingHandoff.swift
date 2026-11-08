import Foundation
import UIKit

/// 1단계 구매 방식: 추천 열차 정보를 복사하고 코레일+ 앱(없으면 웹)으로 넘긴다.
@MainActor
enum BookingHandoff {
    /// 코레일+ 앱 URL 스킴. 실제 스킴은 기기에서 확인 필요(확인 전까지는 웹으로 넘어감).
    static var appURL = URL(string: "korailtalk://")!
    static let webURL = URL(string: "https://www.letskorail.com")!

    static func summary(for plan: TripPlan) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.timeZone = OpeningRule.koreaCalendar.timeZone
        f.dateFormat = "M월 d일(E) HH:mm"
        let time = plan.chosenDeparture.map { f.string(from: $0) } ?? f.string(from: plan.travelDate)
        let train = plan.chosenTrainNo.map { "\(plan.chosenGrade ?? "KTX") \($0)" } ?? "열차 미선택"
        return "\(time) \(plan.fromStationName)→\(plan.toStationName) \(train)"
    }

    static func open(plan: TripPlan) {
        UIPasteboard.general.string = summary(for: plan)
        let app = UIApplication.shared
        if app.canOpenURL(appURL) {
            app.open(appURL)
        } else {
            app.open(webURL)
        }
    }
}

/// 사용자가 붙여넣은 승차권 문자/공유 텍스트에서 열차번호·좌석을 뽑는다.
enum TicketTextParser {
    struct Result: Equatable { var trainNo: String?; var seat: String? }

    static func parse(_ text: String) -> Result {
        Result(trainNo: firstMatch(#"(?:KTX(?:-산천|-이음|-청룡)?|SRT|ITX-\S+|무궁화)\s*(\d{2,5})"#, in: text)
                    ?? firstMatch(#"(\d{2,5})\s*열차"#, in: text),
               seat: firstMatch(#"(\d{1,2}\s*호차\s*\d{1,2}\s*[A-D])"#, in: text)
                    .map { $0.replacingOccurrences(of: " ", with: "") })
    }

    private static func firstMatch(_ pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let m = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              m.numberOfRanges > 1,
              let r = Range(m.range(at: 1), in: text) else { return nil }
        return String(text[r])
    }
}
