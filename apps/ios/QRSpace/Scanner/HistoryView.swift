import SwiftData
import SwiftUI

/// Local scan history (SwiftData, this phone only).
struct HistoryView: View {
    @Environment(\.modelContext) private var db
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \ScanRecord.date, order: .reverse) private var records: [ScanRecord]
    @State private var confirmClear = false

    var body: some View {
        NavigationStack {
            ZStack {
                ScreenBackground()
                if records.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        ScreenTitle(text: tr("scan.history"))
                        Text(tr("history.empty")).font(.system(size: 16)).foregroundStyle(Theme.muted)
                        Spacer()
                    }
                    .padding(16)
                } else {
                    List {
                        Section { ScreenTitle(text: tr("scan.history")).listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 8, trailing: 16)) }
                        ForEach(records) { r in
                            NavigationLink {
                                detail(r)
                            } label: { HistoryRow(record: r) }
                            .listRowBackground(Theme.card)
                        }
                        .onDelete { idx in idx.map { records[$0] }.forEach(db.delete) }
                    }
                    .scrollContentBackground(.hidden)
                    .tabBarClearance()
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }.accessibilityLabel(tr("common.close"))
                }
                if !records.isEmpty {
                    ToolbarItem(placement: .destructiveAction) {
                        Button(tr("history.clear"), role: .destructive) { confirmClear = true }
                    }
                }
            }
            .confirmationDialog(tr("history.clear"), isPresented: $confirmClear, titleVisibility: .visible) {
                Button(tr("history.clear"), role: .destructive) { try? db.delete(model: ScanRecord.self) }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @ViewBuilder private func detail(_ r: ScanRecord) -> some View {
        if case .ours(let link, _) = r.parsed {
            CodeDetailView(source: .link(link), fromScan: false)
        } else {
            ScrollView { ParsedCard(parsed: r.parsed, symbology: r.symbology).padding(16) }.tabBarClearance().background(ScreenBackground())
        }
    }
}

private struct HistoryRow: View {
    let record: ScanRecord
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: record.symbology.is2D ? "qrcode" : "barcode")
                .font(.system(size: 18, weight: .bold))
                .frame(width: 38, height: 38)
                .foregroundStyle(Theme.onAccent)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 6))
            VStack(alignment: .leading, spacing: 3) {
                Text(record.payload.replacingOccurrences(of: "\n", with: " "))
                    .font(.system(size: 15, weight: .semibold)).foregroundStyle(Theme.ink).lineLimit(1)
                Text("\(record.symbology.name) · \(record.date.formatted(date: .abbreviated, time: .shortened))")
                    .font(.system(size: 12)).foregroundStyle(Theme.muted)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
