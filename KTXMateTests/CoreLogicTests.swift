import XCTest
@testable import KTXMate

final class OpeningRuleTests: XCTestCase {
    let cal = OpeningRule.koreaCalendar

    func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 0, _ min: Int = 0) -> Date {
        cal.date(from: DateComponents(year: y, month: m, day: d, hour: h, minute: min))!
    }

    func testOneMonthBeforeAt7() {
        let open = OpeningRule.standard.openDate(forTravelDate: date(2026, 12, 14))
        XCTAssertEqual(open, date(2026, 11, 14, 7))
    }

    func testMonthEndClampsToPreviousMonthEnd() {
        // 3/31 승차 → 2/31 은 없으므로 2/28
        let open = OpeningRule.standard.openDate(forTravelDate: date(2027, 3, 31))
        XCTAssertEqual(open, date(2027, 2, 28, 7))
    }

    func testOverride() {
        var rule = OpeningRule.standard
        rule.overrides["2027-02-06"] = date(2027, 1, 12, 7)
        XCTAssertEqual(rule.openDate(forTravelDate: date(2027, 2, 6)), date(2027, 1, 12, 7))
    }
}

final class RecurrenceExpanderTests: XCTestCase {
    let cal = OpeningRule.koreaCalendar

    func testEveryMondayThisMonthFromToday() {
        let now = cal.date(from: DateComponents(year: 2026, month: 11, day: 8, hour: 13))! // 일요일
        let dates = RecurrenceExpander.dates(
            for: RecurrenceRequest(period: .thisMonth, weekdays: [2]), now: now)
        let days = dates.map { cal.component(.day, from: $0) }
        XCTAssertEqual(days, [9, 16, 23, 30])
    }

    func testNextMonthWeekdays() {
        let now = cal.date(from: DateComponents(year: 2026, month: 11, day: 8))!
        let dates = RecurrenceExpander.dates(
            for: RecurrenceRequest(period: .nextMonth, weekdays: [2]), now: now)
        XCTAssertEqual(dates.map { cal.component(.day, from: $0) }, [7, 14, 21, 28])
    }
}

final class TrainRecommenderTests: XCTestCase {
    let cal = OpeningRule.koreaCalendar

    func train(_ no: String, _ h: Int, _ m: Int, minutes: Int = 160, grade: String = "KTX") -> TrainCandidate {
        let dep = cal.date(from: DateComponents(year: 2026, month: 12, day: 7, hour: h, minute: m))!
        return TrainCandidate(trainNo: no, gradeName: grade, departure: dep,
                              arrival: dep.addingTimeInterval(TimeInterval(minutes * 60)),
                              fromName: "서울", toName: "부산", adultFare: 59800)
    }

    var preferred: Date { cal.date(from: DateComponents(year: 2026, month: 12, day: 7, hour: 7))! }

    func testPicksClosestKTX() {
        let trains = [train("101", 6, 30), train("103", 7, 0), train("105", 7, 30),
                      train("1001", 7, 5, minutes: 300, grade: "무궁화호")]
        let rec = TrainRecommender().recommend(from: trains, preferred: preferred)
        XCTAssertEqual(rec.best?.trainNo, "103")
        XCTAssertFalse(rec.alternatives.contains { $0.trainNo == "103" })
    }

    func testSoldOutGivesAlternative() {
        let trains = [train("101", 6, 30), train("103", 7, 0), train("105", 7, 30)]
        let rec = TrainRecommender().recommend(from: trains, preferred: preferred, excluding: ["103"])
        XCTAssertNotNil(rec.best)
        XCTAssertNotEqual(rec.best?.trainNo, "103")
    }

    func testFarTrainsExcluded() {
        let rec = TrainRecommender().recommend(from: [train("201", 15, 0)], preferred: preferred)
        XCTAssertNil(rec.best)
    }
}

final class ParsingTests: XCTestCase {
    func testTagoJSONArray() throws {
        let json = """
        {"response":{"header":{"resultCode":"00"},"body":{"items":{"item":[
          {"adultcharge":59800,"arrplacename":"부산","arrplandtime":20261207094100,
           "depplacename":"서울","depplandtime":20261207070000,"traingradename":"KTX","trainno":103}
        ]},"numOfRows":200,"pageNo":1,"totalCount":1}}}
        """
        let trains = try TagoTrainClient.parse(Data(json.utf8))
        XCTAssertEqual(trains.count, 1)
        XCTAssertEqual(trains[0].trainNo, "103")
        XCTAssertEqual(trains[0].adultFare, 59800)
        XCTAssertEqual(trains[0].duration, 161 * 60)
    }

    func testTagoJSONSingleObjectAndEmpty() throws {
        let single = """
        {"response":{"body":{"items":{"item":
          {"arrplacename":"부산","arrplandtime":"20261207094100","depplacename":"서울",
           "depplandtime":"20261207070000","traingradename":"KTX-산천","trainno":"105"}
        }}}}
        """
        XCTAssertEqual(try TagoTrainClient.parse(Data(single.utf8)).count, 1)
        let empty = #"{"response":{"body":{"items":""}}}"#
        XCTAssertEqual(try TagoTrainClient.parse(Data(empty.utf8)).count, 0)
    }

    func testTicketText() {
        let r = TicketTextParser.parse("[코레일] 12/07 서울→부산 KTX 103 07:00 5호차 12A 결제완료")
        XCTAssertEqual(r.trainNo, "103")
        XCTAssertEqual(r.seat, "5호차12A")
    }

    func testIntentHelpers() {
        XCTAssertEqual(PlanIntentParser.weekdays(["월", "수요일"]), [2, 4])
        XCTAssertEqual(PlanIntentParser.minutes("07:00"), 420)
        XCTAssertNil(PlanIntentParser.minutes("25:00"))
    }
}
