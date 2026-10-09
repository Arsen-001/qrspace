import Foundation

/// Text from Localizable.xcstrings by key (keys mirror src/lib/i18n*.ts where the site has the wording).
func tr(_ key: String) -> String {
    String(localized: String.LocalizationValue(key))
}

/// Text with "{name}" placeholders, as on the site ("всего {n}").
func tr(_ key: String, _ args: [String: String]) -> String {
    args.reduce(tr(key)) { $0.replacingOccurrences(of: "{\($1.key)}", with: $1.value) }
}

/// Current UI language code among the seven the site supports (for server names like {hy, ru, en}).
var uiLanguage: String {
    let code = Bundle.main.preferredLocalizations.first ?? "en"
    return String(code.prefix(2))
}
