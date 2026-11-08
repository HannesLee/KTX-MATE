import SwiftData
import SwiftUI
import UserNotifications

@main
struct KTXMateApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var service = PlanService()

    var body: some Scene {
        WindowGroup {
            PlanCalendarView()
                .environment(service)
                .task { await service.bootstrap() }
        }
        .modelContainer(for: TripPlan.self)
    }
}

/// 알림의 "코레일+ 열기" 버튼 처리
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        guard response.actionIdentifier == NotificationScheduler.openKorailAction else { return }
        await MainActor.run {
            UIApplication.shared.open(
                UIApplication.shared.canOpenURL(BookingHandoff.appURL) ? BookingHandoff.appURL : BookingHandoff.webURL)
        }
    }
}
