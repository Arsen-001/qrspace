import SwiftUI

/// Where a screen in the home stack leads.
enum HomeRoute: Hashable {
    case create
    case edit(String)
    case view(String)
    case guest(String)
}

/// Home after sign-in — "My QR codes" (the site's HomeDashboard): my codes as dark cards with their own switches
/// and scan counts, a big "+ Create new QR", reminders ("To do") and "Shared with me". Signed out — sign-in.
struct HomeView: View {
    @Environment(Session.self) private var session
    @Environment(Router.self) private var router
    @State private var list: CodeList?
    @State private var error: APIError?
    @State private var path: [HomeRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if session.personId == nil {
                    SignInView()
                } else {
                    dashboard
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: HomeRoute.self) { route in
                switch route {
                case .create:
                    CreateView { id in path = [.edit(id)] }
                case .edit(let id):
                    EditCodeView(id: id, onGuest: { path.append(.guest(id)) })
                case .view(let id):
                    CodeDetailView(source: .id(id))
                case .guest(let id):
                    CodeDetailView(source: .guest(id))
                }
            }
        }
        .task(id: "\(session.generation)-\(session.codesVersion)") { await load() }
        .onChange(of: router.openCode) { _, id in
            guard let id else { return }
            path = [list?.shared.contains { $0.id == id && $0.access != .edit } == true ? .view(id) : .edit(id)]
            router.openCode = nil
        }
        .onChange(of: router.createNew) { _, go in
            guard go else { return }
            path = [.create]
            router.createNew = false
        }
        .onChange(of: session.personId) { _, id in if id == nil { path = []; list = nil } }
    }

    private var dashboard: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                if let list {
                    Upcoming(codes: list.mine + list.shared) { Task { await load() } }
                    if list.mine.isEmpty {
                        firstCode
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 16)], spacing: 16) {
                            ForEach(list.mine) { c in
                                CodeCard(code: c, base: list.base,
                                         onEdit: { path.append(.edit(c.id)) },
                                         onGuest: { path.append(.guest(c.id)) })
                            }
                            newTile
                        }
                    }
                    if !list.shared.isEmpty { shared(list) }
                } else if let error {
                    CardBox {
                        Text(error == .offline ? tr("common.offline") : tr("code.error")).foregroundStyle(Theme.ink)
                        Button(tr("common.retry")) { Task { await load() } }.buttonStyle(.lime)
                    }
                } else {
                    ProgressView().controlSize(.large).tint(Theme.accentInk).frame(maxWidth: .infinity, minHeight: 240)
                }
            }
            .padding(16)
            .frame(maxWidth: 1000)
            .frame(maxWidth: .infinity)
        }
        .background(ScreenBackground())
        .refreshable { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            ScreenTitle(text: tr("dashTitle"), kicker: "QR Space")
            if let list, !list.mine.isEmpty {
                let total = list.mine.reduce(0) { $0 + ($1.stats?.total ?? 0) }
                let week = list.mine.reduce(0) { $0 + ($1.stats?.week ?? 0) }
                HStack(spacing: 6) {
                    (Text("\(tr("navCodes")): ") + Text("\(list.mine.count)").bold().foregroundStyle(Theme.ink)
                        + Text(" · \(tr("dashScansAll")): ") + Text("\(total)").bold().foregroundStyle(Theme.ink))
                        .font(.system(size: 14)).foregroundStyle(Theme.muted)
                    if week > 0 {
                        Text("+\(week)").font(Theme.mono(12, weight: .bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .foregroundStyle(Theme.onAccent).background(Theme.accent, in: RoundedRectangle(cornerRadius: 5))
                            .accessibilityLabel(tr("dashWeek", ["n": "\(week)"]))
                    }
                }
                .accessibilityElement(children: .combine)
            }
            Button { path.append(.create) } label: {
                Label(tr("dashNew"), systemImage: "plus").font(.system(size: 17, weight: .heavy).width(.expanded))
                    .frame(maxWidth: .infinity, minHeight: 56)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.onAccent)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
            .accessibilityIdentifier("create-new")
        }
    }

    private var newTile: some View {
        Button { path.append(.create) } label: {
            VStack(spacing: 12) {
                Image(systemName: "plus").font(.system(size: 26, weight: .black))
                    .frame(width: 56, height: 56)
                    .foregroundStyle(Theme.onAccent)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 16))
                Text(tr("dashNew")).font(.system(size: 16, weight: .heavy).width(.expanded)).foregroundStyle(Theme.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 220)
            .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Theme.line, style: StrokeStyle(lineWidth: 2, dash: [8, 6])))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tr("dashNew"))
    }

    private var firstCode: some View {
        Button { path.append(.create) } label: {
            VStack(alignment: .leading, spacing: 10) {
                Text(tr("firstCodeTitle")).font(Theme.heading(26)).foregroundStyle(Theme.onStage)
                Text(tr("firstCodeText")).font(.system(size: 15)).foregroundStyle(Theme.onStage.opacity(0.7))
                Label(tr("firstCodeCta"), systemImage: "arrow.right")
                    .labelStyle(TrailingIcon())
                    .font(.system(size: 15, weight: .heavy))
                    .padding(.horizontal, 18).frame(minHeight: 48)
                    .foregroundStyle(Theme.onAccent)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.top, 8)
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.stage, in: RoundedRectangle(cornerRadius: 24))
        }
        .buttonStyle(.plain)
    }

    private func shared(_ list: CodeList) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(tr("sharedTitle")).font(Theme.heading(22)).foregroundStyle(Theme.ink).accessibilityAddTraits(.isHeader)
            Text(tr("sharedHint")).font(.system(size: 14)).foregroundStyle(Theme.muted)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                ForEach(list.shared) { c in
                    Button { path.append(c.access == .edit ? .edit(c.id) : .view(c.id)) } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            GeometryReader { g in CodeImage(code: c, base: list.base, size: g.size.width, corner: 12) }
                                .aspectRatio(1, contentMode: .fit)
                            Text(c.title ?? tr("codes.untitled")).font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.ink).lineLimit(1)
                            if let owner = session.name(of: c.owner) {
                                Text(owner).font(.system(size: 12)).foregroundStyle(Theme.muted)
                            }
                        }
                        .padding(10)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.line))
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                }
            }
        }
        .padding(.top, 8)
    }

    private func load() async {
        guard session.personId != nil else { list = nil; return }
        do { list = try await API.shared.codes(); error = nil } catch let e as APIError {
            if e == .login { await session.refresh() } else { error = e }
        } catch { self.error = .offline }
    }
}

struct TrailingIcon: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) { configuration.title; configuration.icon }
    }
}

/// "To do" — reminders across my codes (and codes I can add to): overdue and due within 2 weeks (Upcoming in
/// src/components/CodesPage.tsx), with a "Done" check.
struct Upcoming: View {
    let codes: [CodeView]
    let onDone: () -> Void
    @State private var busy: String?

    private struct Item: Identifiable { let code: CodeView; let task: TaskItem; var id: String { task.id } }

    private var items: [Item] {
        codes.filter(\.canAdd)
            .flatMap { c in (c.tasks ?? []).map { Item(code: c, task: $0) } }
            .filter { Due.daysLeft($0.task.due) <= 14 }
            .sorted { $0.task.due < $1.task.due }
    }

    var body: some View {
        let items = items
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text(tr("upcomingTitle")).font(.system(size: 18, weight: .heavy).width(.expanded)).foregroundStyle(Theme.ink)
                    .accessibilityAddTraits(.isHeader)
                Text(tr("upcomingHint")).font(.system(size: 12)).foregroundStyle(Theme.muted)
                ForEach(items) { it in
                    HStack(alignment: .top, spacing: 12) {
                        Button { done(it) } label: {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10).stroke(Theme.line, lineWidth: 2).frame(width: 34, height: 34)
                                if busy == it.task.id { ProgressView().controlSize(.small) }
                                else { Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.muted) }
                            }
                        }
                        .buttonStyle(.plain)
                        .disabled(busy != nil)
                        .accessibilityLabel("\(tr("markDone")): \(it.task.text)")
                        VStack(alignment: .leading, spacing: 3) {
                            Text(it.task.text).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.ink)
                            (Due.note(it.task.due) + Text(" · \(it.code.title ?? "")").foregroundStyle(Theme.muted))
                                .font(.system(size: 12))
                        }
                        .padding(.top, 6)
                        .accessibilityElement(children: .combine)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 8)
                    if it.id != items.last?.id { Divider().overlay(Theme.line) }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.line))
        }
    }

    private func done(_ it: Item) {
        busy = it.task.id
        Task {
            _ = try? await API.shared.doneTask(it.code.id, task: it.task.id)
            busy = nil
            onDone()
        }
    }
}

/// Due dates of reminders ("2026-10-14", local calendar day).
enum Due {
    static func date(_ ymd: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: ymd)
    }

    /// Days until the due date (negative — overdue).
    static func daysLeft(_ ymd: String, today: Date = Date()) -> Int {
        guard let d = date(ymd) else { return 0 }
        let cal = Calendar.current
        return cal.dateComponents([.day], from: cal.startOfDay(for: today), to: cal.startOfDay(for: d)).day ?? 0
    }

    /// "overdue · 3 days ago" / "today" / "in 5 days" — colored like the site's DueNote.
    static func note(_ ymd: String) -> Text {
        let days = daysLeft(ymd)
        let rel = RelativeDateTimeFormatter()
        rel.dateTimeStyle = .named
        rel.unitsStyle = .full
        rel.locale = uiLocale
        var s = days > 30 ? (date(ymd).map { $0.formatted(Date.FormatStyle(date: .abbreviated, time: .omitted).locale(uiLocale)) } ?? ymd)
            : rel.localizedString(from: DateComponents(day: days))
        if days < 0 { s = "\(tr("overdue")) · \(s)" }
        return Text(s).foregroundStyle(days < 0 ? Theme.warn : days == 0 ? Theme.ok : Theme.muted)
            .fontWeight(days <= 0 ? .semibold : .regular)
    }
}
