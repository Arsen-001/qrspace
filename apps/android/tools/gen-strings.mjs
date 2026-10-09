// Builds app/src/main/res/values*/strings.xml: site wording (src/lib/i18n*.ts, same keys) + app-only strings below.
// Run from apps/android: node tools/gen-strings.mjs   (needs the web app's node_modules for jiti)
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../../..");
const RES = resolve(HERE, "../app/src/main/res");
const { createJiti } = await import(`${WEB}/node_modules/jiti/lib/jiti.mjs`);
const { DICTS } = await createJiti(`${WEB}/`).import("./src/lib/i18n.ts");
const LANGS = ["en", "ru", "hy", "es", "pt", "fr", "de"];
// Site keys used by the app (wording comes from the site).
const SITE_KEYS = ["navCodes", "login", "loginTitle", "cancel", "sharedTitle", "sharedHint", "emptyCodes", "ownerLabel", "loading", "copy", "copied", "memoryEmpty", "notSetUp", "openShort", "closedTitle", "closedHint", "closedMe", "notFound", "notFoundHint", "logout", "accountTitle", "accPurchases", "accPacks", "accScans30", "accScansAll", "accSpace", "accOf", "accPacksLeft", "accSpent", "accFromPack", "accPackUsed", "accNoPacks", "noPurchases", "demoAccount", "accSignedWith", "accLoginText", "loginOnlyHint", "verifyOurs", "verifyForeign", "verifyNoCamera", "verifyNotFound", "verifyPhoto", "verifyOpen", "verifyAgain", "errRetry", "actCopyLink", "actCopyNumber", "actCopyText", "actCopyPassword", "actCopyNetwork", "actOpenSite", "actCall", "actSms", "actEmail", "actMap", "actSaveContact", "wifiHow", "type.url", "type.text", "type.wifi", "type.phone", "type.email", "type.contact", "type.location", "type.sms", "field.ssid", "field.password", "tpl.memory", "tpl.car", "tpl.lost", "tpl.pet", "tpl.item", "tpl.link", "notice.message", "notice.request", "notice.joined", "notice.granted", "notice.outbid", "notice.bid", "notice.sold", "notice.won", "loginHint", "codesCountLabel", "withGoogle", "withApple", "accPackItem", "field.security", "type.event", "actAddCalendar"];
const site = Object.fromEntries(SITE_KEYS.map((k) => [k, Object.fromEntries(LANGS.map((l) => [l, DICTS[l][k] ?? DICTS.en[k]]))]));
for (const k of SITE_KEYS) if (!DICTS.en[k]) throw new Error(`missing site key ${k}`);

// Site placeholders → Android positional args.
const PH = {
  accScansAll: { n: "%1$d" },
  accPackUsed: { used: "%1$d", codes: "%2$d" },
};
const NOTICE = { who: "%1$s", title: "%2$s", amount: "%3$s" };

// App-only strings: [en, ru, hy, es, pt, fr, de]
const APP = {
  app_name: ["QR Space", "QR Space", "QR Space", "QR Space", "QR Space", "QR Space", "QR Space"],
  tab_scan: ["Scan", "Сканер", "Սկաներ", "Escanear", "Escanear", "Scanner", "Scannen"],
  scan_hint: ["Point at a QR code or barcode", "Наведите на QR-код или штрихкод", "Ուղղեք QR կոդի կամ շտրիխ կոդի վրա", "Apunta a un código QR o de barras", "Aponte para um QR code ou código de barras", "Visez un QR code ou un code-barres", "Auf einen QR- oder Barcode richten"],
  torch_on: ["Turn on the flashlight", "Включить фонарик", "Միացնել լապտերը", "Encender la linterna", "Ligar a lanterna", "Allumer la lampe", "Taschenlampe einschalten"],
  torch_off: ["Turn off the flashlight", "Выключить фонарик", "Անջատել լապտերը", "Apagar la linterna", "Desligar a lanterna", "Éteindre la lampe", "Taschenlampe ausschalten"],
  pick_image: ["Scan from a photo", "Скан из фото", "Սկանել լուսանկարից", "Escanear desde una foto", "Ler de uma foto", "Scanner depuis une photo", "Aus Foto scannen"],
  history: ["History", "История", "Պատմություն", "Historial", "Histórico", "Historique", "Verlauf"],
  history_empty: ["No scans yet. Everything you scan is kept here, on this phone only.", "Сканов пока нет. Всё, что отсканируете, сохранится здесь — только на этом телефоне.", "Սկաններ դեռ չկան։ Ամեն ինչ, ինչ սկանեք, կպահվի այստեղ՝ միայն այս հեռախոսում։", "Aún no hay escaneos. Todo lo que escanees se guarda aquí, solo en este teléfono.", "Ainda não há leituras. Tudo o que ler fica guardado aqui, só neste telefone.", "Aucun scan pour l’instant. Tout ce que vous scannez est gardé ici, uniquement sur ce téléphone.", "Noch keine Scans. Alles, was du scannst, bleibt hier – nur auf diesem Telefon."],
  history_clear: ["Clear history", "Очистить историю", "Մաքրել պատմությունը", "Borrar historial", "Limpar histórico", "Effacer l’historique", "Verlauf löschen"],
  history_delete: ["Delete", "Удалить", "Ջնջել", "Eliminar", "Excluir", "Supprimer", "Löschen"],
  camera_title: ["Camera for scanning", "Камера для сканирования", "Տեսախցիկ՝ սկանավորելու համար", "Cámara para escanear", "Câmera para ler códigos", "Caméra pour scanner", "Kamera zum Scannen"],
  camera_text: ["QR Space reads QR codes and barcodes with the camera, right on your phone and even offline. Nothing is filmed or sent anywhere.", "QR Space читает QR-коды и штрихкоды камерой — прямо на телефоне, даже без интернета. Ничего не снимается и никуда не отправляется.", "QR Space-ը տեսախցիկով կարդում է QR և շտրիխ կոդեր՝ հենց հեռախոսում, նույնիսկ առանց ինտերնետի։ Ոչինչ չի նկարահանվում և ոչ մի տեղ չի ուղարկվում։", "QR Space lee códigos QR y de barras con la cámara, en tu teléfono e incluso sin conexión. No se graba ni se envía nada.", "O QR Space lê QR codes e códigos de barras com a câmera, no próprio telefone e até sem internet. Nada é gravado nem enviado.", "QR Space lit les QR codes et les codes-barres avec la caméra, directement sur le téléphone, même hors ligne. Rien n’est filmé ni envoyé.", "QR Space liest QR- und Barcodes mit der Kamera – direkt auf dem Telefon, auch offline. Nichts wird aufgenommen oder gesendet."],
  camera_allow: ["Allow camera", "Разрешить камеру", "Թույլատրել տեսախցիկը", "Permitir cámara", "Permitir câmera", "Autoriser la caméra", "Kamera erlauben"],
  camera_denied: ["Camera access is off. Turn it on in Settings — or scan a code from a photo.", "Доступ к камере выключен. Включите его в настройках — или отсканируйте код из фото.", "Տեսախցիկի հասանելիությունն անջատված է։ Միացրեք այն կարգավորումներում կամ սկանեք կոդը լուսանկարից։", "El acceso a la cámara está desactivado. Actívalo en Ajustes o escanea un código desde una foto.", "O acesso à câmera está desligado. Ative nas Configurações — ou leia um código de uma foto.", "L’accès à la caméra est désactivé. Activez-le dans les Réglages, ou scannez un code depuis une photo.", "Kamerazugriff ist aus. Schalte ihn in den Einstellungen ein – oder scanne einen Code aus einem Foto."],
  open_settings: ["Open settings", "Открыть настройки", "Բացել կարգավորումները", "Abrir ajustes", "Abrir configurações", "Ouvrir les réglages", "Einstellungen öffnen"],
  result_barcode: ["Barcode", "Штрихкод", "Շտրիխ կոդ", "Código de barras", "Código de barras", "Code-barres", "Barcode"],
  result_ours: ["QR Space code", "Код QR Space", "QR Space կոդ", "Código QR Space", "Código QR Space", "Code QR Space", "QR-Space-Code"],
  search_web: ["Search the web", "Найти в интернете", "Որոնել համացանցում", "Buscar en la web", "Pesquisar na web", "Rechercher sur le web", "Im Web suchen"],
  share: ["Share", "Поделиться", "Կիսվել", "Compartir", "Compartilhar", "Partager", "Teilen"],
  wifi_join: ["Connect", "Подключиться", "Միանալ", "Conectar", "Conectar", "Se connecter", "Verbinden"],
  wifi_suggested: ["Network added — the phone will connect when it’s in range", "Сеть добавлена — телефон подключится, когда она будет рядом", "Ցանցն ավելացված է՝ հեռախոսը կմիանա, երբ այն մոտ լինի", "Red añadida: el teléfono se conectará cuando esté cerca", "Rede adicionada — o telefone vai conectar quando estiver por perto", "Réseau ajouté : le téléphone s’y connectera à portée", "Netzwerk hinzugefügt – das Telefon verbindet sich in Reichweite"],
  wifi_open: ["Open network, no password", "Открытая сеть, без пароля", "Բաց ցանց, առանց գաղտնաբառի", "Red abierta, sin contraseña", "Rede aberta, sem senha", "Réseau ouvert, sans mot de passe", "Offenes Netz, ohne Passwort"],
  scan_again: ["Scan again", "Сканировать ещё", "Սկանել նորից", "Escanear otra vez", "Ler de novo", "Scanner à nouveau", "Erneut scannen"],
  opening_code: ["Opening the code…", "Открываем код…", "Բացում ենք կոդը…", "Abriendo el código…", "Abrindo o código…", "Ouverture du code…", "Code wird geöffnet…"],
  open_in_browser: ["Open on qrspace.co", "Открыть на qrspace.co", "Բացել qrspace.co-ում", "Abrir en qrspace.co", "Abrir em qrspace.co", "Ouvrir sur qrspace.co", "Auf qrspace.co öffnen"],
  error_network: ["No connection to qrspace.co. Check the internet.", "Нет связи с qrspace.co. Проверьте интернет.", "qrspace.co-ի հետ կապ չկա։ Ստուգեք ինտերնետը։", "Sin conexión con qrspace.co. Revisa internet.", "Sem conexão com qrspace.co. Verifique a internet.", "Pas de connexion à qrspace.co. Vérifiez internet.", "Keine Verbindung zu qrspace.co. Prüfe das Internet."],
  signin_soon: ["Google and Apple sign-in in the app is coming soon. For now, try the demo accounts.", "Вход через Google и Apple в приложении — скоро. Пока попробуйте демо-аккаунты.", "Google-ով և Apple-ով մուտքը հավելվածում՝ շուտով։ Առայժմ փորձեք դեմո հաշիվները։", "El acceso con Google y Apple en la app llegará pronto. Mientras, prueba las cuentas demo.", "Entrar com Google e Apple no app chega em breve. Por enquanto, teste as contas demo.", "La connexion Google et Apple dans l’app arrive bientôt. En attendant, essayez les comptes démo.", "Anmeldung mit Google und Apple in der App kommt bald. Probiere bis dahin die Demo-Konten."],
  notifications: ["Notifications", "Уведомления", "Ծանուցումներ", "Notificaciones", "Notificações", "Notifications", "Benachrichtigungen"],
  notifications_empty: ["No notifications", "Уведомлений нет", "Ծանուցումներ չկան", "Sin notificaciones", "Sem notificações", "Aucune notification", "Keine Benachrichtigungen"],
  tasks_due: ["Reminders due today: %1$d", "Напоминаний на сегодня: %1$d", "Այսօրվա հիշեցումներ՝ %1$d", "Recordatorios para hoy: %1$d", "Lembretes para hoje: %1$d", "Rappels pour aujourd’hui : %1$d", "Erinnerungen für heute: %1$d"],
  photo: ["Photo", "Фото", "Լուսանկար", "Foto", "Foto", "Photo", "Foto"],
  video: ["Video", "Видео", "Տեսանյութ", "Vídeo", "Vídeo", "Vidéo", "Video"],
  qr_of: ["QR code: %1$s", "QR-код: %1$s", "QR կոդ՝ %1$s", "Código QR: %1$s", "QR code: %1$s", "QR code : %1$s", "QR-Code: %1$s"],
  in_the_code: ["In the code", "В коде", "Կոդում", "En el código", "No código", "Dans le code", "Im Code"],
  memory: ["Memory", "Память", "Հիշողություն", "Memoria", "Memória", "Mémoire", "Erinnerung"],
  tier_simple: ["Simple code", "Простой код", "Պարզ կոդ", "Código simple", "Código simples", "Code simple", "Einfacher Code"],
  tier_styled: ["Styled code", "Красивый код", "Գեղեցիկ կոդ", "Código con estilo", "Código estilizado", "Code stylé", "Gestalteter Code"],
  free: ["Free", "Бесплатно", "Անվճար", "Gratis", "Grátis", "Gratuit", "Kostenlos"],
  back: ["Back", "Назад", "Հետ", "Atrás", "Voltar", "Retour", "Zurück"],
  close: ["Close", "Закрыть", "Փակել", "Cerrar", "Fechar", "Fermer", "Schließen"],
  signed_in_as: ["Signed in as %1$s", "Вы вошли как %1$s", "Մուտք եք գործել որպես %1$s", "Sesión iniciada como %1$s", "Conectado como %1$s", "Connecté en tant que %1$s", "Angemeldet als %1$s"],
  scanned_count: ["Scans: %1$d", "Сканов: %1$d", "Սկաններ՝ %1$d", "Escaneos: %1$d", "Leituras: %1$d", "Scans : %1$d", "Scans: %1$d"],
  copied_toast: null, // filled from site "copied"
  barcode_type: ["Type: %1$s", "Тип: %1$s", "Տեսակ՝ %1$s", "Tipo: %1$s", "Tipo: %1$s", "Type : %1$s", "Typ: %1$s"],
  scanner_offline: ["Works without internet", "Работает без интернета", "Աշխատում է առանց ինտերնետի", "Funciona sin internet", "Funciona sem internet", "Fonctionne sans internet", "Funktioniert ohne Internet"],
  hidden_owner: ["Owner is hidden", "Хозяин скрыт", "Տերը թաքնված է", "Propietario oculto", "Dono oculto", "Propriétaire masqué", "Besitzer verborgen"],
  space_used: ["%1$s of %2$s", "%1$s из %2$s", "%1$s / %2$s", "%1$s de %2$s", "%1$s de %2$s", "%1$s sur %2$s", "%1$s von %2$s"],
};
delete APP.copied_toast;

// Site keys → Android names.
const NAME = (k) => k.replace(/\./g, "_").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/^@/, "\\@")
    .replace(/^\?/, "\\?");

for (const [i, l] of LANGS.entries()) {
  const rows = [];
  for (const [k, v] of Object.entries(APP)) rows.push([k, v[i]]);
  for (const [k, v] of Object.entries(site)) {
    let s = v[l] ?? v.en;
    const ph = k.startsWith("notice.") ? NOTICE : PH[k];
    if (ph) s = s.replace(/\{(\w+)\}/g, (_, n) => ph[n] ?? `{${n}}`);
    rows.push([NAME(k), s]);
  }
  const body = rows
    .map(([k, s]) => {
      const fmt = /%\d\$/.test(s);
      const e = esc(s).replace(/%(?!\d\$[sd])/g, "%%");
      return `    <string name="${k}"${k === "app_name" ? ' translatable="false"' : ""}${fmt ? "" : ""}>${e}</string>`;
    })
    .filter((r, idx) => !(l !== "en" && rows[idx][0] === "app_name"));
  const dir = l === "en" ? `${RES}/values` : `${RES}/values-${l}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/strings.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated: site wording from src/lib/i18n*.ts + app-only strings. Edit the generator, not by hand. -->\n<resources>\n${body.join("\n")}\n</resources>\n`);
}
console.log("ok", Object.keys(APP).length + Object.keys(site).length, "strings");
