import SwiftData
import SwiftUI

/// 일정 상세: 예매하러 가기, 예매 완료 처리, 매진 시 차선 선택
struct PlanDetailView: View {
    @Environment(PlanService.self) private var service
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Bindable var plan: TripPlan

    @State private var ticketText = ""
    @State private var alternatives: [TrainCandidate] = []
    @State private var loadingAlternatives = false

    var body: some View {
        Form {
            Section {
                LabeledContent("상태") { Text(plan.status.label).foregroundStyle(plan.status.color) }
                LabeledContent("승차일", value: plan.travelDate.formatted(.dateTime.year().month().day().weekday()))
                LabeledContent("구간", value: "\(plan.fromStationName) → \(plan.toStationName)")
                if let no = plan.chosenTrainNo, let dep = plan.chosenDeparture {
                    LabeledContent("열차", value: "\(dep.formatted(date: .omitted, time: .shortened)) \(plan.chosenGrade ?? "") \(no)")
                }
                if let seat = plan.seatInfo { LabeledContent("좌석", value: seat) }
                LabeledContent("예매 오픈", value: plan.openAt.formatted(.dateTime.month().day().hour().minute()))
            }

            if plan.status != .booked {
                Section {
                    Button("코레일+에서 예매하기") { BookingHandoff.open(plan: plan) }
                        .disabled(Date.now < plan.openAt)
                    if Date.now < plan.openAt {
                        Text("오픈 전입니다. 오픈 하루 전, 10분 전, 정각에 알려 드려요.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                } footer: {
                    Text("열차 정보가 클립보드에 복사됩니다.")
                }

                Section("예매했나요?") {
                    TextField("승차권 문자나 공유 내용을 붙여넣기 (선택)", text: $ticketText, axis: .vertical)
                    Button("예매 완료로 표시") {
                        Task { await service.markBooked(plan, ticketText: ticketText.isEmpty ? nil : ticketText, in: context) }
                    }
                }

                Section("표가 없나요?") {
                    Button(loadingAlternatives ? "찾는 중…" : "매진 — 차선 열차 보기") {
                        Task {
                            loadingAlternatives = true
                            alternatives = await service.markSoldOut(plan, in: context)
                            loadingAlternatives = false
                        }
                    }
                    ForEach(alternatives) { train in
                        Button { Task { await service.switchTrain(plan, to: train, in: context); alternatives = [] } } label: {
                            TrainLine(train: train, badge: "차선")
                        }
                    }
                }
            }

            Section {
                Button("일정 삭제", role: .destructive) {
                    Task { await service.delete(plan, in: context); dismiss() }
                }
            }
        }
        .navigationTitle("\(plan.fromStationName) → \(plan.toStationName)")
    }
}
