import Foundation
import SwiftData

/// One scan in the local history (stays on this phone; never sent anywhere).
@Model
final class ScanRecord {
    var payload: String
    var symbologyRaw: String
    var date: Date

    init(payload: String, symbology: Symbology, date: Date = .now) {
        self.payload = payload
        self.symbologyRaw = symbology.rawValue
        self.date = date
    }

    var symbology: Symbology { Symbology(rawValue: symbologyRaw) ?? .unknown }
    var parsed: Parsed { Parsed.parse(payload, symbology: symbology) }
}

/// What the scanner hands to the result sheet.
struct ScanHit: Identifiable, Equatable {
    let id = UUID()
    let payload: String
    let symbology: Symbology
    var parsed: Parsed { Parsed.parse(payload, symbology: symbology) }
    var isOurs: Bool { if case .ours = parsed { true } else { false } }
}
