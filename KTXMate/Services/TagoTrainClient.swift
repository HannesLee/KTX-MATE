import Foundation

/// 국토교통부 TAGO 열차정보 서비스 (공공데이터포털, 공식·무료).
/// https://www.data.go.kr/data/15098552/openapi.do
/// 시간표/운임만 제공하고 잔여석 정보는 없다.
protocol TrainTimetableProviding: Sendable {
    func trains(from: Station, to: Station, on date: Date) async throws -> [TrainCandidate]
}

struct TagoTrainClient: TrainTimetableProviding {
    enum ClientError: Error { case missingServiceKey, badResponse(String) }

    var serviceKey: String
    var session: URLSession = .shared
    private let baseURL = URL(string: "https://apis.data.go.kr/1613000/TrainInfoService")!

    /// Info.plist 의 TAGOServiceKey 에서 키를 읽는다.
    static func fromBundle() -> TagoTrainClient {
        let key = Bundle.main.object(forInfoDictionaryKey: "TAGOServiceKey") as? String ?? ""
        return TagoTrainClient(serviceKey: key)
    }

    func trains(from: Station, to: Station, on date: Date) async throws -> [TrainCandidate] {
        guard !serviceKey.isEmpty else { throw ClientError.missingServiceKey }

        var components = URLComponents(url: baseURL.appending(path: "getStrtpntAlocFndTrainInfo"),
                                       resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "serviceKey", value: serviceKey),
            URLQueryItem(name: "depPlaceId", value: from.id),
            URLQueryItem(name: "arrPlaceId", value: to.id),
            URLQueryItem(name: "depPlandTime", value: Self.yyyyMMdd(date)),
            URLQueryItem(name: "numOfRows", value: "200"),
            URLQueryItem(name: "pageNo", value: "1"),
            URLQueryItem(name: "_type", value: "json"),
        ]
        let (data, response) = try await session.data(from: components.url!)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw ClientError.badResponse(String(decoding: data, as: UTF8.self))
        }
        return try Self.parse(data)
    }

    // MARK: - 파싱 (테스트에서 직접 호출)

    static func parse(_ data: Data) throws -> [TrainCandidate] {
        let envelope = try JSONDecoder().decode(Envelope.self, from: data)
        return envelope.response.body.items.list.compactMap { item in
            guard let dep = parseTime(item.depplandtime),
                  let arr = parseTime(item.arrplandtime) else { return nil }
            return TrainCandidate(trainNo: item.trainno.text,
                                  gradeName: item.traingradename,
                                  departure: dep,
                                  arrival: arr,
                                  fromName: item.depplacename,
                                  toName: item.arrplacename,
                                  adultFare: item.adultcharge.flatMap { Int($0.text) })
        }
    }

    static func yyyyMMdd(_ date: Date) -> String {
        OpeningRule.dayKey(date).replacingOccurrences(of: "-", with: "")
    }

    /// 20261208070000 → Date (KST)
    static func parseTime(_ value: FlexibleString) -> Date? {
        let s = value.text
        guard s.count == 14 else { return nil }
        let f = DateFormatter()
        f.calendar = OpeningRule.koreaCalendar
        f.timeZone = OpeningRule.koreaCalendar.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyyMMddHHmmss"
        return f.date(from: s)
    }

    // MARK: - 응답 모델

    struct Envelope: Decodable { let response: Response }
    struct Response: Decodable { let body: Body }
    struct Body: Decodable { let items: Items }

    /// 결과가 0건이면 items 가 "" 이고, 1건이면 item 이 배열이 아닌 객체로 오는 경우가 있어 둘 다 처리.
    struct Items: Decodable {
        let list: [Item]
        private enum Keys: String, CodingKey { case item }

        init(from decoder: Decoder) throws {
            if let single = try? decoder.singleValueContainer(), (try? single.decode(String.self)) != nil {
                list = []; return
            }
            let c = try decoder.container(keyedBy: Keys.self)
            if let many = try? c.decode([Item].self, forKey: .item) {
                list = many
            } else if let one = try? c.decode(Item.self, forKey: .item) {
                list = [one]
            } else {
                list = []
            }
        }
    }

    struct Item: Decodable {
        let adultcharge: FlexibleString?
        let arrplacename: String
        let arrplandtime: FlexibleString
        let depplacename: String
        let depplandtime: FlexibleString
        let traingradename: String
        let trainno: FlexibleString
    }

    /// 숫자/문자 어느 쪽으로 와도 문자열로 받는다.
    struct FlexibleString: Decodable {
        let text: String
        init(_ text: String) { self.text = text }
        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let s = try? c.decode(String.self) { text = s }
            else if let i = try? c.decode(Int64.self) { text = String(i) }
            else if let d = try? c.decode(Double.self) { text = String(Int64(d)) }
            else { text = "" }
        }
    }
}
