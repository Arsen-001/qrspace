// Юридические страницы: условия, конфиденциальность, «без возвратов» (владелец 09.10.2026: «рефанда не будет — купил и всё»). ЧЕРНОВИК по тому, как сайт работает на самом деле —
// перед запуском показать юристу (не юридическая консультация). Данные оператора — из переменных окружения
// (NEXT_PUBLIC_OPERATOR_NAME / _ADDRESS / _EMAIL), пока их нет — «будут указаны при запуске».
import type { BaseLang, Lang } from "./i18n";

export const LEGAL_DOCS = ["terms", "privacy", "refunds"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export const LEGAL_UPDATED = "2026-10-09";

/**
 * Оператор сайта и приложений (владелец 09.10.2026: «под AI Switch LLC будем оба делать» — QR Space и BookTime):
 * ООО «АИ Свитч» / AI Switch LLC, рег. номер 999.110.1592631, ИНН 01098805 (реквизиты — как в BookTime).
 * Почта — info@booktime.am, пока не заработает support@qrspace.co (пересылка Cloudflare → info@booktime.am).
 */
const OPERATOR = {
  name: { ru: "ООО «АИ Свитч» (AI Switch LLC), ИНН 01098805", hy: "«ԱԻ ՍՎԻՏՉ» ՍՊԸ (AI Switch LLC), ՀՎՀՀ 01098805", en: "AI Switch LLC (tax ID 01098805)" },
  address: { ru: "Армения, 0056, Ереван, ул. Кочаряна, 10, кв. 4", hy: "Հայաստան, 0056, Երևան, Քոչարյան փ., 10, բն. 4", en: "10 Kocharyan St, Apt 4, Yerevan 0056, Armenia" },
  email: process.env.NEXT_PUBLIC_OPERATOR_EMAIL || "info@booktime.am",
};
export const operatorFor = (lang: Lang) => {
  const l: BaseLang = lang === "ru" || lang === "hy" ? lang : "en";
  return { name: OPERATOR.name[l], address: OPERATOR.address[l], email: OPERATOR.email };
};

type Section = { h: string; p: string[] };
type Doc = { title: string; intro: string; sections: Section[] };

const ru: Record<LegalDoc, Doc> = {
  terms: {
    title: "Условия использования",
    intro: "Пользуясь QR Space, вы соглашаетесь с этими условиями. Мы писали их простыми словами — если что-то непонятно, напишите нам.",
    sections: [
      { h: "1. Что такое QR Space", p: ["Сайт, где можно сделать красивый QR-код, положить под него «память» (текст, фото, видео), решить, кто её видит, купить коллекционные коды. Оператор сайта и его реквизиты указаны в разделе «Контакты»."] },
      { h: "2. Аккаунт", p: ["Вход — только через Google или Apple. Пароль у нас не хранится.", "Пользоваться сайтом можно с 16 лет. Вы отвечаете за то, что происходит в вашем аккаунте.", "Удалить аккаунт можно в любой момент в профиле — вместе с кодами, памятью, фото и видео."] },
      { h: "3. Ваши коды и память", p: ["Всё, что вы загружаете, остаётся вашим. Вы разрешаете нам хранить это и показывать тем, кому вы открыли код (все, контакты, выбранные люди или только вы).", "В наших кодах — наша короткая ссылка: скан открывает страницу QR Space с тем, что вы указали (сайт, телефон, Wi-Fi, контакт, событие, память), и кнопками. Что в коде, кто это видит (все, выбранные люди или только вы) можно менять без перепечатки. Пароль Wi-Fi и другие данные в коде мы храним, чтобы показать их тем, кому вы открыли код. Перед печатью проверьте, что код читается: сайт проверяет это сам, но камеры бывают разные."] },
      { h: "4. Что нельзя", p: ["Мошенничество и поддельные сайты (в том числе через код-ссылку), вредоносные программы, спам.", "Незаконное, оскорбительное, чужие личные данные без согласия, преследование.", "Чужие логотипы и товарные знаки без права на них — в продаваемых дизайнах.", "По жалобам мы проверяем коды и можем заблокировать код или аккаунт. Заблокированный код ничего не показывает и никуда не ведёт."] },
      { h: "5. Покупки", p: ["Первый простой код — бесплатно, дальше — по цене на сайте (в долларах США). Сам код оплачивается один раз, без подписки: скачанный код — и бесплатный тоже — продолжает работать, даже если вы больше ничего не покупаете, пока работает сайт. Помесячно — только место под кодом больше бесплатного 1 МБ.", "Платежи принимает платёжный сервис-посредник; данные карты к нам не попадают.", "Все покупки окончательные — деньги не возвращаются (страница «Без возвратов»). Код и место выдаются сразу после оплаты; оплачивая, вы соглашаетесь, что получаете их немедленно и отказаться от покупки после этого нельзя."] },
      { h: "6. Коллекционные коды и аукционы", p: ["Тираж ограничен: номер в тираже принадлежит одному человеку. Мы ведём реестр владельцев.", "Ставка на аукционе — обязательство купить, если она окажется лучшей. При продаже мы удерживаем комиссию (сейчас 10%).", "Код переходит покупателю без памяти прежнего владельца. Покупка коллекционного кода — не вложение денег: мы не обещаем, что его цена вырастет."] },
      { h: "7. Ответственность", p: ["Мы стараемся, чтобы сайт работал без перерывов, но сервис предоставляется «как есть». Мы не отвечаем за косвенные убытки (например, за напечатанный тираж, если код не проверили перед печатью).", "Если мы закроем сервис, заранее предупредим и дадим скачать ваши данные."] },
      { h: "8. Изменения", p: ["Условия могут меняться. О важных изменениях предупредим на сайте заранее. Дата обновления — вверху страницы."] },
      { h: "9. Прочее", p: ["QR Code — зарегистрированный товарный знак DENSO WAVE INCORPORATED.", "Применимое право и порядок споров — по месту регистрации оператора (раздел «Контакты»)."] },
    ],
  },
  privacy: {
    title: "Конфиденциальность",
    intro: "Коротко: мы собираем только то, что нужно для работы сайта, не продаём данные и не ставим рекламных трекеров. Почту человека другим не показываем никогда.",
    sections: [
      { h: "Что мы храним", p: ["Аккаунт: имя, почта и номер аккаунта у Google или Apple.", "То, что вы сами добавили: коды и их оформление, память (текст, фото, видео), напоминания, контакты, списки людей, названия.", "Сканы ваших кодов: время и вошёл ли человек (адрес IP не храним).", "«Связь через нас»: текст сообщения, контакт для ответа и место — только если нашедший сам решил их отправить.", "Покупки, пакеты, место под кодами, ставки, жалобы."] },
      { h: "Зачем", p: ["Чтобы сайт работал: показывать память тем, кому вы открыли код, доставлять сообщения, принимать оплату.", "Чтобы защищать людей: лимиты от спама, проверка жалоб."] },
      { h: "Кто видит", p: ["Память — только те, кому вы открыли код. Другим людям видно ваше имя (если у вас есть общий код или вы продаёте в маркете), почта — никогда.", "Платёжный сервис — данные для оплаты. Хостинг — хранит данные по нашему поручению. Apple и Google — адрес телефона и текст уведомления, если вы включили уведомления в приложении. Больше никому не передаём и не продаём."] },
      { h: "Приложения для iPhone и Android", p: ["Камера — только чтобы прочитать код: кадры обрабатываются на телефоне и никуда не отправляются. Фото из галереи для распознавания тоже остаются на телефоне — на сервер попадает только то, что вы сами добавили в память кода.", "История сканов хранится только на вашем телефоне; очистить её можно в приложении. Если в коде ссылка, приложение спрашивает у нас, наш ли это код, — саму ссылку мы не храним. Скан нашего кода считается так же, как на сайте.", "Уведомления — только если вы их разрешили: храним адрес вашего телефона для уведомлений (его выдают Apple или Google) и язык, отправляем через Apple Push Notification service и Firebase Cloud Messaging. Выйдете из приложения или выключите уведомления в настройках телефона — адрес удаляем.", "Вход в приложении — тот же аккаунт, что на сайте; одноразовый код входа живёт 5 минут.", "На Android коды читает Google ML Kit на самом телефоне; он может отправлять Google обезличенные сведения о работе (модель телефона, версия приложения, ошибки) — кадры камеры не отправляет."] },
      { h: "Cookies", p: ["Только нужные для работы: вход (подписанная cookie), метка для лимитов от спама. Язык сайта хранится в вашем браузере. Рекламных и аналитических трекеров нет."] },
      { h: "Сколько храним и удаление", p: ["Пока у вас есть аккаунт. Удалили аккаунт в профиле — удаляем коды, память, фото, видео, контакты, уведомления и телефоны для уведомлений; из резервных копий — в течение 30 дней. Сведения об оплатах храним столько, сколько требует закон."] },
      { h: "Ваши права", p: ["Узнать, что о вас хранится, исправить, удалить, получить копию — напишите нам (раздел «Контакты»)."] },
      { h: "Дети", p: ["Сайт для людей от 16 лет. Если узнаем, что аккаунт создал ребёнок младше, удалим его."] },
      { h: "Безопасность", p: ["Вход через Google и Apple, подписанные cookie, доступ к фото и видео — только по правилам «кто видит». Если узнаем об утечке, сообщим."] },
    ],
  },
  refunds: {
    title: "Без возвратов",
    intro: "Купили — и всё: деньги не возвращаются. Поэтому смотреть, настраивать и проверять код можно бесплатно и сколько угодно — платите только за то, что уже увидели и проверили.",
    sections: [
      { h: "Все покупки окончательные", p: ["Деньги за коды, место, пакеты и коллекционные коды не возвращаются — ни частично, ни полностью."] },
      { h: "Коды", p: ["Перед оплатой сайт сам проверяет, что код читается, и показывает его целиком. Купленный код выдаётся сразу и работает всегда — подписки нет."] },
      { h: "Место под кодом", p: ["Место больше 1 МБ — помесячно. Его можно уменьшить или не продлевать в любой момент; за уже начавшийся месяц деньги не возвращаются. Не продлили — снова 1 МБ, то, что уже лежит, не пропадает."] },
      { h: "Пакеты", p: ["Коды из пакета не сгорают — берите их, когда нужно. Неиспользованные коды деньгами не возвращаются."] },
      { h: "Маркет и аукционы", p: ["Коллекционный код переходит вам сразу после оплаты, а деньги при перепродаже — продавцу, поэтому вернуть покупку нельзя."] },
      { h: "Если что-то не работает по нашей вине", p: ["Код не открывается или страница скана не работает из-за нас — исправим или бесплатно заменим код. Напишите на почту из раздела «Контакты»."] },
    ],
  },
};

const en: Record<LegalDoc, Doc> = {
  terms: {
    title: "Terms of use",
    intro: "By using QR Space you agree to these terms. We wrote them in plain words — if anything is unclear, write to us.",
    sections: [
      { h: "1. What QR Space is", p: ["A site where you can make a beautiful QR code, put a “memory” behind it (text, photos, videos), decide who sees it, and buy collectible codes. The site operator and its details are in the Contacts section."] },
      { h: "2. Account", p: ["Sign-in is only with Google or Apple. We don’t store passwords.", "You must be 16 or older. You are responsible for what happens in your account.", "You can delete your account any time in your profile — together with your codes, memories, photos and videos."] },
      { h: "3. Your codes and memories", p: ["Everything you upload stays yours. You allow us to store it and show it to the people you opened the code to (everyone, contacts, chosen people or only you).", "Our codes hold our short link: a scan opens a QR Space page with what you set (a website, phone, Wi-Fi, contact, event, memory) and buttons. You can change what’s in the code and who sees it (everyone, chosen people or only you) without reprinting. We store the Wi-Fi password and other data in the code to show them to the people you opened the code to. Check that a code scans before printing: the site checks it, but cameras differ."] },
      { h: "4. What’s not allowed", p: ["Scams and fake websites (including via link codes), malware, spam.", "Anything illegal or abusive, other people’s personal data without consent, harassment.", "Other companies’ logos and trademarks without rights — in designs for sale.", "We review reports and may block a code or an account. A blocked code shows nothing and leads nowhere."] },
      { h: "5. Purchases", p: ["Your first simple code is free, then prices are as shown on the site (in US dollars). A code itself is paid once, no subscription: a downloaded code — free ones too — keeps working even if you never buy anything else, as long as the site works. Only space under a code beyond the free 1 MB is monthly.", "Payments are handled by a payment provider acting as reseller; your card details never reach us.", "All sales are final — no refunds (see the No refunds page). Codes and space are delivered right after payment; by paying you agree to receive them immediately and that the purchase can’t be withdrawn after that."] },
      { h: "6. Collectible codes and auctions", p: ["Editions are limited: a number in an edition belongs to one person. We keep the ownership registry.", "An auction bid is a commitment to buy if it wins. On a sale we keep a fee (currently 10%).", "A code passes to the buyer without the previous owner’s memory. A collectible is not an investment: we don’t promise its price will rise."] },
      { h: "7. Liability", p: ["We work to keep the site running, but the service is provided “as is”. We are not liable for indirect losses (for example, a printed batch if the code wasn’t checked before printing).", "If we ever close the service, we’ll warn you in advance and let you download your data."] },
      { h: "8. Changes", p: ["These terms may change. We’ll announce important changes on the site in advance. The update date is at the top of the page."] },
      { h: "9. Other", p: ["QR Code is a registered trademark of DENSO WAVE INCORPORATED.", "Governing law and disputes — per the operator’s place of registration (Contacts section)."] },
    ],
  },
  privacy: {
    title: "Privacy",
    intro: "In short: we collect only what the site needs to work, we don’t sell data and we don’t use advertising trackers. We never show a person’s email to others.",
    sections: [
      { h: "What we store", p: ["Account: name, email and account ID at Google or Apple.", "What you add: codes and their design, memories (text, photos, videos), reminders, contacts, people lists, titles.", "Scans of your codes: time and whether the person was signed in (we don’t store IP addresses).", "“Contact through us”: the message, a reply contact and a location — only if the finder chose to send them.", "Purchases, packs, space under codes, bids, reports."] },
      { h: "Why", p: ["To make the site work: show memories to the people you allowed, deliver messages, take payments.", "To protect people: spam limits, report reviews."] },
      { h: "Who sees it", p: ["Memories — only the people you opened the code to. Others can see your name (if you share a code with them or sell in the market), never your email.", "The payment provider — payment data. Hosting — stores data on our behalf. Apple and Google — your phone’s address and the notification text, if you turned notifications on in the app. We don’t share or sell data to anyone else."] },
      { h: "iPhone and Android apps", p: ["The camera is used only to read codes: frames are processed on your phone and never sent anywhere. Photos you pick to decode also stay on the phone — only what you add to a code’s memory reaches our server.", "Scan history is stored only on your phone; you can clear it in the app. If a code holds a link, the app asks us whether it’s one of our codes — we don’t store the link. A scan of our code is counted the same way as on the website.", "Notifications only if you allow them: we store your phone’s notification address (issued by Apple or Google) and language, and send through Apple Push Notification service and Firebase Cloud Messaging. Sign out of the app or turn notifications off in the phone’s settings and we delete the address.", "Signing in to the app uses the same account as the website; the one-time sign-in code lives for 5 minutes.", "On Android, codes are read by Google ML Kit on the phone itself; it may send Google anonymous diagnostics (phone model, app version, errors) — it does not send camera frames."] },
      { h: "Cookies", p: ["Only the ones needed to work: sign-in (a signed cookie) and a marker for spam limits. The site language is stored in your browser. No advertising or analytics trackers."] },
      { h: "Retention and deletion", p: ["As long as you have an account. Delete your account in your profile and we delete your codes, memories, photos, videos, contacts, notifications and phones for notifications; backups are cleared within 30 days. Payment records are kept as long as the law requires."] },
      { h: "Your rights", p: ["To find out what we store about you, correct it, delete it or get a copy — write to us (Contacts section)."] },
      { h: "Children", p: ["The site is for people aged 16 and over. If we learn an account was created by a younger child, we’ll delete it."] },
      { h: "Security", p: ["Sign-in via Google and Apple, signed cookies, photos and videos available only under the “who sees it” rules. If we learn of a breach, we’ll tell you."] },
    ],
  },
  refunds: {
    title: "No refunds",
    intro: "Once you buy, it’s yours — we don’t give refunds. That’s why you can view, design and check a code for free as long as you like: you only pay for what you’ve already seen and checked.",
    sections: [
      { h: "All sales are final", p: ["Money paid for codes, space, packs and collectible codes is not refunded — neither in part nor in full."] },
      { h: "Codes", p: ["Before you pay, the site checks that the code scans and shows it in full. A bought code is delivered immediately and works forever — there’s no subscription."] },
      { h: "Space under a code", p: ["Space beyond 1 MB is monthly. You can reduce it or stop renewing any time; a month that has already started isn’t refunded. Not renewed — back to 1 MB, and what’s already there stays."] },
      { h: "Packs", p: ["Codes in a pack don’t expire — use them whenever you need. Unused codes aren’t refunded as money."] },
      { h: "Market and auctions", p: ["A collectible code passes to you right after payment, and on resale the money goes to the seller, so a purchase can’t be returned."] },
      { h: "If something doesn’t work because of us", p: ["If a code doesn’t open or the scan page doesn’t work because of us, we’ll fix it or replace the code for free. Email us (Contacts section)."] },
    ],
  },
};

const hy: Record<LegalDoc, Doc> = {
  terms: {
    title: "Օգտագործման պայմաններ",
    intro: "Օգտվելով QR Space-ից՝ դուք համաձայնում եք այս պայմաններին։ Գրել ենք պարզ բառերով — եթե ինչ-որ բան պարզ չէ, գրեք մեզ։",
    sections: [
      { h: "1. Ինչ է QR Space-ը", p: ["Կայք, որտեղ կարելի է ստեղծել գեղեցիկ QR կոդ, դրա տակ դնել «հիշողություն» (տեքստ, լուսանկար, տեսանյութ), որոշել, թե ով է այն տեսնում, գնել հավաքածուի կոդեր։ Կայքի օպերատորը և նրա տվյալները նշված են «Կոնտակտներ» բաժնում։"] },
      { h: "2. Հաշիվ", p: ["Մուտքը՝ միայն Google-ով կամ Apple-ով։ Գաղտնաբառեր չենք պահում։", "Կայքից կարելի է օգտվել 16 տարեկանից։ Դուք պատասխանատու եք ձեր հաշվում կատարվողի համար։", "Հաշիվը կարելի է ջնջել ցանկացած պահի պրոֆիլում՝ կոդերի, հիշողության, լուսանկարների և տեսանյութերի հետ։"] },
      { h: "3. Ձեր կոդերը և հիշողությունը", p: ["Այն ամենը, ինչ վերբեռնում եք, մնում է ձերը։ Թույլ եք տալիս մեզ պահել այն և ցույց տալ նրանց, ում բացել եք կոդը (բոլորին, կոնտակտներին, ընտրված մարդկանց կամ միայն ձեզ)։", "Մեր կոդերում մեր կարճ հղումն է. սկանը բացում է QR Space էջ՝ ձեր նշածով (կայք, հեռախոս, Wi-Fi, կոնտակտ, իրադարձություն, հիշողություն) և կոճակներով։ Թե ինչ կա կոդում և ով է այն տեսնում (բոլորը, ընտրված մարդիկ կամ միայն դուք), կարելի է փոխել առանց վերատպման։ Wi-Fi-ի գաղտնաբառը և կոդի մյուս տվյալները պահում ենք, որպեսզի ցույց տանք նրանց, ում բացել եք կոդը։ Տպելուց առաջ ստուգեք, որ կոդը կարդացվում է. կայքն ինքն է ստուգում, բայց տեսախցիկները տարբեր են։"] },
      { h: "4. Ինչն է արգելված", p: ["Խարդախություն և կեղծ կայքեր (այդ թվում կոդ-հղումով), վնասակար ծրագրեր, սպամ։", "Անօրինական, վիրավորական բովանդակություն, ուրիշի անձնական տվյալներ առանց համաձայնության, հետապնդում։", "Ուրիշի լոգոներ և ապրանքային նշաններ առանց իրավունքի՝ վաճառվող դիզայններում։", "Բողոքներով ստուգում ենք կոդերը և կարող ենք արգելափակել կոդը կամ հաշիվը։ Արգելափակված կոդը ոչինչ ցույց չի տալիս և ոչ մի տեղ չի տանում։"] },
      { h: "5. Գնումներ", p: ["Առաջին պարզ կոդն անվճար է, հետո՝ կայքում նշված գնով (ԱՄՆ դոլարով)։ Կոդն ինքը վճարվում է մեկ անգամ, առանց բաժանորդագրության. ներբեռնված կոդը, այդ թվում՝ անվճարը, շարունակում է աշխատել, նույնիսկ եթե այլևս ոչինչ չեք գնում, քանի դեռ կայքն աշխատում է։ Ամսական է միայն կոդի տակ անվճար 1 ՄԲ-ից ավելի տեղը։", "Վճարումներն ընդունում է միջնորդ վճարային ծառայությունը. քարտի տվյալները մեզ չեն հասնում։", "Բոլոր գնումները վերջնական են՝ գումարը չի վերադարձվում («Առանց վերադարձի» էջ)։ Կոդը և տեղը տրվում են վճարումից անմիջապես հետո. վճարելով՝ համաձայնում եք դրանք ստանալ անմիջապես, և դրանից հետո գնումից հրաժարվել հնարավոր չէ։"] },
      { h: "6. Հավաքածուի կոդեր և աճուրդներ", p: ["Թողարկումը սահմանափակ է. թողարկման համարը պատկանում է մեկ մարդու։ Մենք վարում ենք տերերի գրանցամատյանը։", "Աճուրդի խաղադրույքը պարտավորություն է գնելու, եթե այն լավագույնը լինի։ Վաճառքից պահում ենք միջնորդավճար (հիմա՝ 10%)։", "Կոդն անցնում է գնորդին առանց նախորդ տիրոջ հիշողության։ Հավաքածուի կոդը ներդրում չէ. չենք խոստանում, որ դրա գինը կաճի։"] },
      { h: "7. Պատասխանատվություն", p: ["Ջանում ենք, որ կայքն աշխատի առանց ընդհատումների, բայց ծառայությունը տրամադրվում է «ինչպես կա»։ Չենք պատասխանատու անուղղակի վնասների համար (օրինակ՝ տպված տիրաժի, եթե կոդը չեն ստուգել տպելուց առաջ)։", "Եթե փակենք ծառայությունը, նախապես կզգուշացնենք և թույլ կտանք ներբեռնել ձեր տվյալները։"] },
      { h: "8. Փոփոխություններ", p: ["Պայմանները կարող են փոխվել։ Կարևոր փոփոխությունների մասին նախապես կզգուշացնենք կայքում։ Թարմացման ամսաթիվը՝ էջի վերևում։"] },
      { h: "9. Այլ", p: ["QR Code-ը DENSO WAVE INCORPORATED-ի գրանցված ապրանքային նշանն է։", "Կիրառելի իրավունքը և վեճերի կարգը՝ ըստ օպերատորի գրանցման վայրի («Կոնտակտներ» բաժին)։"] },
    ],
  },
  privacy: {
    title: "Գաղտնիություն",
    intro: "Կարճ՝ հավաքում ենք միայն այն, ինչ պետք է կայքի աշխատանքի համար, տվյալներ չենք վաճառում և գովազդային հետագծիչներ չենք դնում։ Մարդու փոստը ուրիշներին երբեք ցույց չենք տալիս։",
    sections: [
      { h: "Ինչ ենք պահում", p: ["Հաշիվ՝ անուն, փոստ և հաշվի համար Google-ում կամ Apple-ում։", "Այն, ինչ ինքներդ եք ավելացրել՝ կոդեր և դրանց ձևավորում, հիշողություն (տեքստ, լուսանկար, տեսանյութ), հիշեցումներ, կոնտակտներ, մարդկանց ցուցակներ, անուններ։", "Ձեր կոդերի սկանները՝ ժամանակը և արդյոք մարդը մուտք էր գործել (IP հասցեն չենք պահում)։", "«Կապ մեր միջոցով»՝ հաղորդագրության տեքստը, պատասխանի կոնտակտը և վայրը՝ միայն եթե գտնողն ինքն է որոշել ուղարկել։", "Գնումներ, փաթեթներ, կոդերի տակ տեղ, խաղադրույքներ, բողոքներ։"] },
      { h: "Ինչի համար", p: ["Որպեսզի կայքն աշխատի՝ ցույց տալ հիշողությունը նրանց, ում բացել եք կոդը, առաքել հաղորդագրությունները, ընդունել վճարումներ։", "Մարդկանց պաշտպանելու համար՝ սպամի սահմանափակումներ, բողոքների ստուգում։"] },
      { h: "Ով է տեսնում", p: ["Հիշողությունը՝ միայն նրանք, ում բացել եք կոդը։ Ուրիշներին երևում է ձեր անունը (եթե ունեք ընդհանուր կոդ կամ վաճառում եք շուկայում), փոստը՝ երբեք։", "Վճարային ծառայությունը՝ վճարման տվյալները։ Հոսթինգը՝ պահում է տվյալները մեր հանձնարարությամբ։ Apple-ը և Google-ը՝ հեռախոսի հասցեն և ծանուցման տեքստը, եթե հավելվածում միացրել եք ծանուցումները։ Ուրիշ ոչ մեկին չենք փոխանցում և չենք վաճառում։"] },
      { h: "Հավելվածներ iPhone-ի և Android-ի համար", p: ["Տեսախցիկը՝ միայն կոդը կարդալու համար. կադրերը մշակվում են հեռախոսում և ոչ մի տեղ չեն ուղարկվում։ Ճանաչման համար ընտրած լուսանկարները նույնպես մնում են հեռախոսում. սերվեր է հասնում միայն այն, ինչ ինքներդ ավելացրել եք կոդի հիշողության մեջ։", "Սկանների պատմությունը պահվում է միայն ձեր հեռախոսում. այն կարելի է մաքրել հավելվածում։ Եթե կոդում հղում է, հավելվածը մեզ հարցնում է՝ արդյոք դա մեր կոդն է. հղումն ինքնին մենք չենք պահում։ Մեր կոդի սկանը հաշվվում է նույն կերպ, ինչպես կայքում։", "Ծանուցումներ՝ միայն եթե թույլ եք տվել. պահում ենք ձեր հեռախոսի ծանուցումների հասցեն (այն տալիս են Apple-ը կամ Google-ը) և լեզուն, ուղարկում ենք Apple Push Notification service-ի և Firebase Cloud Messaging-ի միջոցով։ Դուրս գաք հավելվածից կամ անջատեք ծանուցումները հեռախոսի կարգավորումներում՝ հասցեն ջնջում ենք։", "Հավելվածում մուտքը՝ նույն հաշիվն է, ինչ կայքում. մեկանգամյա մուտքի կոդը գործում է 5 րոպե։", "Android-ում կոդերը կարդում է Google ML Kit-ը հենց հեռախոսում. այն կարող է Google-ին ուղարկել անանուն տվյալներ աշխատանքի մասին (հեռախոսի մոդել, հավելվածի տարբերակ, սխալներ)՝ տեսախցիկի կադրերը չի ուղարկում։"] },
      { h: "Cookies", p: ["Միայն աշխատանքի համար անհրաժեշտները՝ մուտք (ստորագրված cookie), սպամի սահմանափակման նշան։ Կայքի լեզուն պահվում է ձեր դիտարկիչում։ Գովազդային և վերլուծական հետագծիչներ չկան։"] },
      { h: "Որքան ենք պահում և ջնջում", p: ["Քանի դեռ ունեք հաշիվ։ Ջնջեցիք հաշիվը պրոֆիլում — ջնջում ենք կոդերը, հիշողությունը, լուսանկարները, տեսանյութերը, կոնտակտները, ծանուցումները և ծանուցումների հեռախոսները, պահուստային պատճեններից՝ 30 օրվա ընթացքում։ Վճարումների մասին տեղեկությունները պահում ենք օրենքով պահանջվող ժամկետով։"] },
      { h: "Ձեր իրավունքները", p: ["Իմանալ, թե ինչ է պահվում ձեր մասին, ուղղել, ջնջել, ստանալ պատճեն — գրեք մեզ («Կոնտակտներ» բաժին)։"] },
      { h: "Երեխաներ", p: ["Կայքը 16 տարեկանից բարձր մարդկանց համար է։ Եթե իմանանք, որ հաշիվը ստեղծել է ավելի փոքր երեխա, կջնջենք այն։"] },
      { h: "Անվտանգություն", p: ["Մուտք Google-ով և Apple-ով, ստորագրված cookie-ներ, լուսանկարներն ու տեսանյութերը՝ միայն «ով է տեսնում» կանոններով։ Եթե իմանանք արտահոսքի մասին, կտեղեկացնենք։"] },
    ],
  },
  refunds: {
    title: "Առանց վերադարձի",
    intro: "Գնեցիք՝ և վերջ. գումարը չի վերադարձվում։ Դրա համար կոդը դիտել, կարգավորել և ստուգել կարելի է անվճար և որքան ուզեք՝ վճարում եք միայն այն բանի համար, ինչն արդեն տեսել ու ստուգել եք։",
    sections: [
      { h: "Բոլոր գնումները վերջնական են", p: ["Կոդերի, տեղի, փաթեթների և հավաքածուի կոդերի համար վճարված գումարը չի վերադարձվում՝ ոչ մասնակի, ոչ ամբողջությամբ։"] },
      { h: "Կոդեր", p: ["Վճարելուց առաջ կայքն ինքն է ստուգում, որ կոդը կարդացվում է, և ցույց է տալիս այն ամբողջությամբ։ Գնված կոդը տրվում է անմիջապես և աշխատում է միշտ՝ բաժանորդագրություն չկա։"] },
      { h: "Տեղը կոդի տակ", p: ["1 ՄԲ-ից ավելի տեղը ամսական է։ Այն կարելի է փոքրացնել կամ չերկարացնել ցանկացած պահի. արդեն սկսված ամսվա գումարը չի վերադարձվում։ Չերկարացրիք՝ կրկին 1 ՄԲ, եղածը չի կորչում։"] },
      { h: "Փաթեթներ", p: ["Փաթեթի կոդերը չեն այրվում՝ վերցրեք, երբ պետք է։ Չօգտագործված կոդերը գումարով չեն վերադարձվում։"] },
      { h: "Շուկա և աճուրդներ", p: ["Հավաքածուի կոդն անցնում է ձեզ վճարումից անմիջապես հետո, իսկ վերավաճառքի դեպքում գումարը՝ վաճառողին, ուստի գնումը հետ վերադարձնել հնարավոր չէ։"] },
      { h: "Եթե ինչ-որ բան չի աշխատում մեր մեղքով", p: ["Կոդը չի բացվում կամ սկանի էջը չի աշխատում մեր պատճառով — կուղղենք կամ անվճար կփոխարինենք կոդը։ Գրեք «Կոնտակտներ» բաժնի փոստին։"] },
    ],
  },
};

const BY_LANG: Record<BaseLang, Record<LegalDoc, Doc>> = { ru, en, hy };
/** Документы на языке человека; где перевода пока нет — английский. */
export const legalFor = (lang: Lang) => BY_LANG[lang as BaseLang] ?? BY_LANG.en;
export const LEGAL_RU = ru;
