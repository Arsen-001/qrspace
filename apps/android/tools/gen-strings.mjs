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
const SITE_KEYS = ["navCodes", "login", "loginTitle", "cancel", "sharedTitle", "sharedHint", "ownerLabel", "loading", "copy", "copied", "memoryEmpty", "notSetUp", "openShort", "closedTitle", "closedHint", "closedMe", "notFound", "notFoundHint", "logout", "accountTitle", "accPurchases", "accPacks", "accScans30", "accScansAll", "accSpace", "accOf", "accPacksLeft", "accSpent", "accFromPack", "accPackUsed", "accNoPacks", "noPurchases", "demoAccount", "accSignedWith", "accLoginText", "loginOnlyHint", "verifyOurs", "verifyForeign", "verifyNoCamera", "verifyNotFound", "verifyPhoto", "verifyOpen", "verifyAgain", "errRetry", "actCopyLink", "actCopyNumber", "actCopyText", "actCopyPassword", "actCopyNetwork", "actOpenSite", "actCall", "actSms", "actEmail", "actMap", "actSaveContact", "wifiHow", "type.url", "type.text", "type.wifi", "type.phone", "type.email", "type.contact", "type.location", "type.sms", "field.ssid", "field.password", "tpl.memory", "tpl.car", "tpl.lost", "tpl.pet", "tpl.item", "tpl.link", "notice.message", "notice.request", "notice.joined", "notice.granted", "notice.outbid", "notice.bid", "notice.sold", "notice.won", "loginHint", "codesCountLabel", "withGoogle", "withApple", "accPackItem", "field.security", "type.event", "actAddCalendar"];
// Families the create/edit screens show by id (also written to ui/SiteText.kt as key → R.string maps).
const FAMILIES = {
  type: ["url", "text", "wifi", "contact", "location", "event", "phone", "sms", "email", "whatsapp", "telegram", "viber", "instagram", "facebook", "tiktok", "youtube", "linkedin", "x"],
  hint: ["url", "text", "wifi", "contact", "location", "event", "phone", "sms", "email", "whatsapp", "telegram", "viber", "instagram", "facebook", "tiktok", "youtube", "linkedin", "x"],
  field: ["url", "text", "ssid", "password", "security", "phone", "message", "username", "email", "subject", "body", "firstName", "lastName", "company", "website", "place", "title", "start", "end", "notes"],
  group: ["main", "contact", "social"],
  security: ["WPA", "WEP", "nopass"],
  dot: ["square", "rounded", "dots", "diamond", "star", "heart", "plus", "liquid", "leaf", "circuit"],
  eye: ["square", "rounded", "circle", "leaf", "drop", "dropOut", "octagon", "mixed", "dotted", "chip", "ornate"],
  preset: ["classic", "soft", "dots", "lime", "night", "hearts", "stars", "circuit", "gradient", "raised"],
  vis: ["all", "contacts", "people", "me"],
  visHint: ["all", "contacts", "people", "me"],
  tplHint: ["memory", "car", "lost", "pet"],
};
// Home dashboard, create, edit, room offer, sign-in (09.10.2026).
SITE_KEYS.push(
  "dashTitle", "dashNew", "dashWeek", "dashScansAll", "dashUnderShort", "dashAsGuest", "dashEmptyMemory", "dashEmptyMemoryHint", "edit", "heroSwitch",
  "scansCount", "records", "upcomingTitle", "upcomingHint", "markDone", "overdue", "firstCodeTitle", "firstCodeText", "firstCodeCta", "editionNo", "lostMode",
  "makeTitle", "step1", "step2", "showPassword", "fg", "bg", "colors", "dots", "eyes", "styleReady", "lowContrast", "firstFree",
  "payTitle", "freeFirst", "packFrom", "packLeft", "packRoom", "buyDemo", "templateLabel", "newCodeTitle", "newCodePlaceholder", "create", "titleLabel",
  "saveError", "save", "saved", "delete", "visTitle", "tabAccess", "tabLink", "linkHint", "tabMemory", "storageTitle", "storagePaidUntil", "composerTitle", "addText", "addPhoto",
  "addVideo", "upload", "replace", "textPlaceholder", "captionPlaceholder", "uploading", "videoLimit", "videoTooBig", "upTooBigTitle", "upSizes", "upNeed",
  "upPay", "upOwnerOnly", "upMax", "storageFull", "uploadError", "you", "providersPending", "tpl.pet", "downloadFree", "payAndDownload", "packDownload", "deleteAccount", "deleteAccountSure", "deleteAccountYes",
  "packsTitle", "packBuy", "packBought",
  ...Object.entries(FAMILIES).flatMap(([f, ids]) => ids.map((id) => `${f}.${id}`)),
);
const SITE = [...new Set(SITE_KEYS)];

const site = Object.fromEntries(SITE.map((k) => [k, Object.fromEntries(LANGS.map((l) => [l, DICTS[l][k] ?? DICTS.en[k]]))]));
for (const k of SITE) if (!DICTS.en[k]) throw new Error(`missing site key ${k}`);
// Google Play gives prices already formatted ("$0.99", "390 ֏") — the site's "${price}" sentences without their "$".
for (const [k, from] of Object.entries({ upNeedStore: "upNeed", upPayStore: "upPay" })) {
  site[k] = Object.fromEntries(LANGS.map((l) => {
    if (!site[from][l].includes("${price}")) throw new Error(`${from}.${l} has no \${price}`);
    return [l, site[from][l].replace("${price}", "{price}")];
  }));
}

// Site placeholders → Android positional args.
const PH = {
  accScansAll: { n: "%1$d" },
  accPackUsed: { used: "%1$d", codes: "%2$d" },
  dashWeek: { n: "%1$d" },
  upSizes: { file: "%1$s", free: "%2$s", quota: "%3$s" },
  upNeed: { size: "%1$s", price: "%2$s" },
  upPay: { price: "%1$s" },
  upNeedStore: { size: "%1$s", price: "%2$s" },
  upPayStore: { price: "%1$s" },
  upMax: { max: "%1$s" },
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
  copied_toast: null, // filled from site "copied"
  barcode_type: ["Type: %1$s", "Тип: %1$s", "Տեսակ՝ %1$s", "Tipo: %1$s", "Tipo: %1$s", "Type : %1$s", "Typ: %1$s"],
  scanner_offline: ["Works without internet", "Работает без интернета", "Աշխատում է առանց ինտերնետի", "Funciona sin internet", "Funciona sem internet", "Fonctionne sans internet", "Funktioniert ohne Internet"],
  hidden_owner: ["Owner is hidden", "Хозяин скрыт", "Տերը թաքնված է", "Propietario oculto", "Dono oculto", "Propriétaire masqué", "Besitzer verborgen"],
  mode_content: ["QR with content", "QR с содержимым", "QR՝ բովանդակությամբ", "QR con contenido", "QR com conteúdo", "QR avec contenu", "QR mit Inhalt"],
  mode_content_hint: ["Link, Wi‑Fi, phone, contact, text — the scan opens it", "Ссылка, Wi‑Fi, телефон, контакт, текст — скан откроет это", "Հղում, Wi‑Fi, հեռախոս, կոնտակտ, տեքստ՝ սկանը կբացի դա", "Enlace, Wi‑Fi, teléfono, contacto, texto: el escaneo lo abre", "Link, Wi‑Fi, telefone, contato, texto — a leitura abre isso", "Lien, Wi‑Fi, téléphone, contact, texte : le scan l’ouvre", "Link, WLAN, Telefon, Kontakt, Text – der Scan öffnet es"],
  mode_memory: ["Memory code", "Код с памятью", "Հիշողությամբ կոդ", "Código con memoria", "Código com memória", "Code avec mémoire", "Code mit Erinnerung"],
  mode_memory_hint: ["Photos, video and text under the code — add them any time", "Фото, видео и текст под кодом — добавляйте когда угодно", "Լուսանկարներ, տեսանյութ և տեքստ կոդի տակ՝ ավելացրեք ցանկացած պահի", "Fotos, vídeo y texto bajo el código: añádelos cuando quieras", "Fotos, vídeo e texto sob o código — adicione quando quiser", "Photos, vidéo et texte sous le code : ajoutez-les quand vous voulez", "Fotos, Video und Text unter dem Code – jederzeit hinzufügen"],
  code_name_optional: ["Name in My codes (optional)", "Название в «Моих кодах» (необязательно)", "Անունը «Իմ կոդերում» (ըստ ցանկության)", "Nombre en Mis códigos (opcional)", "Nome em Meus códigos (opcional)", "Nom dans Mes codes (facultatif)", "Name in Meine Codes (optional)"],
  create_free: ["Create for free", "Создать бесплатно", "Ստեղծել անվճար", "Crear gratis", "Criar grátis", "Créer gratuitement", "Kostenlos erstellen"],
  create_pay: ["Pay %1$s and create", "Оплатить %1$s и создать", "Վճարել %1$s և ստեղծել", "Pagar %1$s y crear", "Pagar %1$s e criar", "Payer %1$s et créer", "%1$s zahlen und erstellen"],
  create_from_pack: ["Create from the pack", "Создать из пакета", "Ստեղծել փաթեթից", "Crear del paquete", "Criar do pacote", "Créer depuis le pack", "Aus dem Paket erstellen"],
  creating: ["Creating…", "Создаём…", "Ստեղծում ենք…", "Creando…", "Criando…", "Création…", "Wird erstellt…"],
  limit_today: ["You’ve reached today’s limit of new codes — try again tomorrow.", "На сегодня новых кодов больше нельзя — попробуйте завтра.", "Այսօրվա նոր կոդերի սահմանը լրացել է՝ փորձեք վաղը։", "Has llegado al límite de códigos nuevos de hoy: inténtalo mañana.", "Você atingiu o limite de códigos novos de hoje — tente amanhã.", "Limite de nouveaux codes atteinte pour aujourd’hui : réessayez demain.", "Das Tageslimit für neue Codes ist erreicht – versuch es morgen."],
  pick_date: ["Pick date and time", "Выбрать дату и время", "Ընտրել ամսաթիվ և ժամ", "Elegir fecha y hora", "Escolher data e hora", "Choisir la date et l’heure", "Datum und Uhrzeit wählen"],
  login_to_create: ["Sign in to create codes — they stay yours.", "Войдите, чтобы создавать коды, — так они останутся за вами.", "Մուտք գործեք՝ կոդեր ստեղծելու համար, այդպես դրանք կմնան ձերը։", "Inicia sesión para crear códigos: así serán tuyos.", "Entre para criar códigos — assim eles ficam seus.", "Connectez-vous pour créer des codes : ils resteront à vous.", "Melde dich an, um Codes zu erstellen – so bleiben sie deine."],
  preview_label: ["Preview of the code", "Предпросмотр кода", "Կոդի նախադիտում", "Vista previa del código", "Prévia do código", "Aperçu du code", "Vorschau des Codes"],
  share_image: ["Share the picture", "Поделиться картинкой", "Կիսվել նկարով", "Compartir la imagen", "Compartilhar a imagem", "Partager l’image", "Bild teilen"],
  file_unsupported: ["This file type isn’t supported: photos JPG, PNG, WebP; videos MP4, MOV, WebM.", "Такой файл не подходит: фото — JPG, PNG, WebP; видео — MP4, MOV, WebM.", "Այս ֆայլը չի համապատասխանում՝ լուսանկար՝ JPG, PNG, WebP, տեսանյութ՝ MP4, MOV, WebM։", "Este tipo de archivo no sirve: fotos JPG, PNG, WebP; vídeos MP4, MOV, WebM.", "Este tipo de arquivo não serve: fotos JPG, PNG, WebP; vídeos MP4, MOV, WebM.", "Ce type de fichier n’est pas pris en charge : photos JPG, PNG, WebP ; vidéos MP4, MOV, WebM.", "Dieser Dateityp geht nicht: Fotos JPG, PNG, WebP; Videos MP4, MOV, WebM."],
  delete_confirm: ["Delete this entry?", "Удалить эту запись?", "Ջնջե՞լ այս գրառումը", "¿Eliminar esta entrada?", "Excluir esta entrada?", "Supprimer cette entrée ?", "Diesen Eintrag löschen?"],
  more_on_site: ["People, messages, reminders and the look — on qrspace.co", "Люди, сообщения, напоминания и вид кода — на qrspace.co", "Մարդիկ, հաղորդագրություններ, հիշեցումներ և կոդի տեսքը՝ qrspace.co-ում", "Personas, mensajes, recordatorios y el aspecto: en qrspace.co", "Pessoas, mensagens, lembretes e o visual — em qrspace.co", "Personnes, messages, rappels et apparence : sur qrspace.co", "Personen, Nachrichten, Erinnerungen und Aussehen – auf qrspace.co"],
  signin_site: ["Sign in on %1$s", "Войти на %1$s", "Մուտք %1$s-ում", "Entrar en %1$s", "Entrar em %1$s", "Se connecter sur %1$s", "Auf %1$s anmelden"],
  signin_site_hint: ["Opens the site in a browser tab, then brings you back here signed in.", "Откроет сайт во вкладке браузера и вернёт сюда уже с входом.", "Կբացի կայքը դիտարկչի ներդիրում և կվերադարձնի այստեղ՝ արդեն մուտք գործած։", "Abre el sitio en una pestaña del navegador y te devuelve aquí con la sesión iniciada.", "Abre o site numa aba do navegador e traz você de volta já conectado.", "Ouvre le site dans un onglet du navigateur, puis vous ramène ici connecté.", "Öffnet die Website in einem Browser-Tab und bringt dich angemeldet zurück."],
  signin_wait: ["Signing in…", "Входим…", "Մուտք ենք գործում…", "Iniciando sesión…", "Entrando…", "Connexion…", "Anmeldung…"],
  signin_failed: ["Sign-in didn’t finish — try again.", "Вход не завершился — попробуйте ещё раз.", "Մուտքը չավարտվեց՝ փորձեք նորից։", "No se completó el inicio de sesión: inténtalo de nuevo.", "O login não terminou — tente de novo.", "La connexion n’a pas abouti : réessayez.", "Die Anmeldung wurde nicht abgeschlossen – versuch es noch einmal."],
  server_title: ["Server (debug build)", "Сервер (отладочная сборка)", "Սերվեր (debug)", "Servidor (versión de depuración)", "Servidor (build de depuração)", "Serveur (version de débogage)", "Server (Debug-Build)"],
  server_apply: ["Use", "Выбрать", "Ընտրել", "Usar", "Usar", "Utiliser", "Verwenden"],
  unread_count: ["Unread: %1$d", "Непрочитанных: %1$d", "Չկարդացված՝ %1$d", "Sin leer: %1$d", "Não lidas: %1$d", "Non lus : %1$d", "Ungelesen: %1$d"],
  space_used: ["%1$s of %2$s", "%1$s из %2$s", "%1$s / %2$s", "%1$s de %2$s", "%1$s de %2$s", "%1$s sur %2$s", "%1$s von %2$s"],
  // A build without purchases (BuildConfig.PURCHASES_ENABLED = false, Google Play payments rule): no prices, no "buy".
  iap_off_create: ["This code can’t be made in the app yet. Here: your first simple code and codes from your packs.", "Этот код пока нельзя сделать в приложении. Здесь — первый простой код и коды из ваших пакетов.", "Այս կոդը դեռ հնարավոր չէ ստեղծել հավելվածում։ Այստեղ՝ ձեր առաջին պարզ կոդը և կոդերը ձեր փաթեթներից։", "Este código aún no se puede crear en la app. Aquí: tu primer código simple y los códigos de tus packs.", "Este código ainda não pode ser criado no app. Aqui: seu primeiro código simples e os códigos dos seus pacotes.", "Ce code ne peut pas encore être créé dans l’app. Ici : votre premier code simple et les codes de vos packs.", "Dieser Code lässt sich in der App noch nicht erstellen. Hier: dein erster einfacher Code und Codes aus deinen Paketen."],
  iap_off_picture: ["The picture of this code isn’t available in the app yet.", "Картинку этого кода пока нельзя получить в приложении.", "Այս կոդի նկարը դեռ հասանելի չէ հավելվածում։", "La imagen de este código aún no está disponible en la app.", "A imagem deste código ainda não está disponível no app.", "L’image de ce code n’est pas encore disponible dans l’app.", "Das Bild dieses Codes ist in der App noch nicht verfügbar."],
  iap_off_space: ["Not enough space under the code. Pick a smaller file or delete something.", "Под кодом не хватает места. Выберите файл поменьше или удалите что-то.", "Կոդի տակ տեղը չի բավականացնում։ Ընտրեք ավելի փոքր ֆայլ կամ ջնջեք ինչ-որ բան։", "No hay espacio suficiente bajo el código. Elige un archivo más pequeño o borra algo.", "Falta espaço sob o código. Escolha um arquivo menor ou apague algo.", "Pas assez d’espace sous le code. Choisissez un fichier plus petit ou supprimez quelque chose.", "Nicht genug Platz unter dem Code. Wähle eine kleinere Datei oder lösche etwas."],
  // Google Play Billing (billing/Store.kt).
  iap_unavailable: ["Purchases unavailable right now.", "Покупки сейчас недоступны.", "Գնումներն այժմ հասանելի չեն։", "Las compras no están disponibles ahora.", "As compras não estão disponíveis agora.", "Les achats ne sont pas disponibles pour le moment.", "Käufe sind gerade nicht verfügbar."],
  iap_pending: ["Payment is pending — we’ll finish as soon as Google Play confirms it.", "Оплата ещё идёт — закончим, как только Google Play её подтвердит.", "Վճարումը դեռ ընթացքի մեջ է՝ կավարտենք, հենց Google Play-ը հաստատի։", "El pago está pendiente: terminaremos en cuanto Google Play lo confirme.", "O pagamento está pendente — concluímos assim que o Google Play confirmar.", "Paiement en attente — on termine dès que Google Play le confirme.", "Die Zahlung steht aus — wir schließen ab, sobald Google Play sie bestätigt."],
  iap_failed: ["The purchase didn’t finish. Try again — if Google Play charged you, it finishes later or is refunded automatically.", "Покупка не завершилась. Попробуйте ещё раз — если Google Play списал деньги, покупка завершится позже или деньги вернутся сами.", "Գնումը չավարտվեց։ Փորձեք նորից՝ եթե Google Play-ը գանձել է գումարը, գնումը կավարտվի ավելի ուշ կամ գումարը կվերադարձվի ինքնաբերաբար։", "La compra no se completó. Inténtalo de nuevo: si Google Play te cobró, se completará más tarde o se te reembolsará automáticamente.", "A compra não foi concluída. Tente de novo — se o Google Play cobrou, ela será concluída depois ou reembolsada automaticamente.", "L’achat n’a pas abouti. Réessayez — si Google Play vous a débité, il se terminera plus tard ou sera remboursé automatiquement.", "Der Kauf wurde nicht abgeschlossen. Versuch es noch einmal — falls Google Play abgebucht hat, wird er später abgeschlossen oder automatisch erstattet."],
  iap_off_video_limit: ["The video has to fit in the free space under the code.", "Видео должно поместиться в свободное место под кодом.", "Տեսանյութը պետք է տեղավորվի կոդի տակ ազատ տեղում։", "El video tiene que caber en el espacio libre bajo el código.", "O vídeo precisa caber no espaço livre sob o código.", "La vidéo doit tenir dans l’espace libre sous le code.", "Das Video muss in den freien Platz unter dem Code passen."],
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
  const dup = rows.map(([k]) => k).filter((k, i, a) => a.indexOf(k) !== i);
  if (dup.length) throw new Error(`duplicate string names: ${dup.join(", ")}`);
  const dir = l === "en" ? `${RES}/values` : `${RES}/values-${l}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/strings.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated: site wording from src/lib/i18n*.ts + app-only strings. Edit the generator, not by hand. -->\n<resources>\n${body.join("\n")}\n</resources>\n`);
}

// Site families → R.string maps for Kotlin (ids picked at runtime: content types, fields, shapes, presets…).
const kt = Object.entries(FAMILIES)
  .map(([f, ids]) => `    val ${f}: Map<String, Int> = mapOf(${ids.map((id) => `"${id}" to R.string.${NAME(`${f}.${id}`)}`).join(", ")})`)
  .join("\n");
writeFileSync(
  resolve(HERE, "../app/src/main/java/co/qrspace/app/ui/SiteText.kt"),
  `// Generated by tools/gen-strings.mjs — site wording families → string resources. Edit the generator, not by hand.\npackage co.qrspace.app.ui\n\nimport co.qrspace.app.R\n\nobject SiteText {\n${kt}\n}\n`,
);
console.log("ok", Object.keys(APP).length + Object.keys(site).length, "strings");
