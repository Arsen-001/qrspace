// Юридические страницы: условия, конфиденциальность, возвраты. ЧЕРНОВИК по тому, как сайт работает на самом деле —
// перед запуском показать юристу (не юридическая консультация). Данные оператора — из переменных окружения
// (NEXT_PUBLIC_OPERATOR_NAME / _ADDRESS / _EMAIL), пока их нет — «будут указаны при запуске».
import type { BaseLang, Lang } from "./i18n";

export const LEGAL_DOCS = ["terms", "privacy", "refunds"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export const LEGAL_UPDATED = "2026-10-06";

export const operator = {
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME || "",
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS || "",
  email: process.env.NEXT_PUBLIC_OPERATOR_EMAIL || "",
};

type Section = { h: string; p: string[] };
type Doc = { title: string; intro: string; sections: Section[] };

const ru: Record<LegalDoc, Doc> = {
  terms: {
    title: "Условия использования",
    intro: "Пользуясь QR Studio, вы соглашаетесь с этими условиями. Мы писали их простыми словами — если что-то непонятно, напишите нам.",
    sections: [
      { h: "1. Что такое QR Studio", p: ["Сайт, где можно сделать красивый QR-код, положить под него «память» (текст, фото, видео), решить, кто её видит, купить коллекционные коды, номера и товары с кодом. Оператор сайта и его реквизиты указаны в разделе «Контакты»."] },
      { h: "2. Аккаунт", p: ["Вход — только через Google или Apple. Пароль у нас не хранится.", "Пользоваться сайтом можно с 16 лет. Вы отвечаете за то, что происходит в вашем аккаунте.", "Удалить аккаунт можно в любой момент в профиле — вместе с кодами, памятью, фото и видео."] },
      { h: "3. Ваши коды и память", p: ["Всё, что вы загружаете, остаётся вашим. Вы разрешаете нам хранить это и показывать тем, кому вы открыли код (все, контакты, выбранные люди или только вы).", "Напечатанный код ведёт на нашу страницу — поэтому память и доступ можно менять без перепечатки. Перед печатью проверьте, что код читается: сайт проверяет это сам, но камеры бывают разные."] },
      { h: "4. Что нельзя", p: ["Мошенничество и поддельные сайты (в том числе через код-ссылку), вредоносные программы, спам.", "Незаконное, оскорбительное, чужие личные данные без согласия, преследование.", "Чужие логотипы и товарные знаки без права на них — в продаваемых дизайнах и товарах.", "По жалобам мы проверяем коды и можем заблокировать код или аккаунт. Заблокированный код ничего не показывает и никуда не ведёт."] },
      { h: "5. Покупки", p: ["Первый простой код — бесплатно, дальше — по цене на сайте (в долларах США). Оплата — один раз за код, без подписки: оплаченный код работает, пока работает сайт.", "Платежи принимает платёжный сервис-посредник; данные карты к нам не попадают.", "Возвраты — по правилам на странице «Возвраты»."] },
      { h: "6. Коллекционные коды, номера и аукционы", p: ["Тираж ограничен: номер в тираже (или номер от 1 до 1 000 000) принадлежит одному человеку. Мы ведём реестр владельцев.", "Ставка на аукционе — обязательство купить, если она окажется лучшей. При продаже мы удерживаем комиссию (сейчас 10%).", "Код переходит покупателю без памяти прежнего владельца. Покупка коллекционного кода — не вложение денег: мы не обещаем, что его цена вырастет."] },
      { h: "7. Бренды и защита от подделок", p: ["Бренд отвечает за свои товары и за то, кому выдаёт бирки. Мы даём инструмент проверки и не гарантируем, что подделок не будет."] },
      { h: "8. Товары", p: ["Товары с вашим кодом печатаются по заказу. Сроки и доставка — при оформлении. Брак — заменим или вернём деньги."] },
      { h: "9. Ответственность", p: ["Мы стараемся, чтобы сайт работал без перерывов, но сервис предоставляется «как есть». Мы не отвечаем за косвенные убытки (например, за напечатанный тираж, если код не проверили перед печатью).", "Если мы закроем сервис, заранее предупредим и дадим скачать ваши данные."] },
      { h: "10. Изменения", p: ["Условия могут меняться. О важных изменениях предупредим на сайте заранее. Дата обновления — вверху страницы."] },
      { h: "11. Прочее", p: ["QR Code — зарегистрированный товарный знак DENSO WAVE INCORPORATED.", "Применимое право и порядок споров — по месту регистрации оператора (раздел «Контакты»)."] },
    ],
  },
  privacy: {
    title: "Конфиденциальность",
    intro: "Коротко: мы собираем только то, что нужно для работы сайта, не продаём данные и не ставим рекламных трекеров. Почту человека другим не показываем никогда.",
    sections: [
      { h: "Что мы храним", p: ["Аккаунт: имя, почта и номер аккаунта у Google или Apple.", "То, что вы сами добавили: коды и их оформление, память (текст, фото, видео), напоминания, контакты, списки людей, названия.", "Сканы ваших кодов: время и вошёл ли человек (адрес IP не храним).", "«Связь через нас»: текст сообщения, контакт для ответа и место — только если нашедший сам решил их отправить.", "Покупки, заказы товаров (имя, телефон, адрес доставки), заказы брендов, ставки, жалобы."] },
      { h: "Зачем", p: ["Чтобы сайт работал: показывать память тем, кому вы открыли код, доставлять сообщения, принимать оплату, печатать и доставлять товары.", "Чтобы защищать людей: лимиты от спама, проверка жалоб, защита от подделок."] },
      { h: "Кто видит", p: ["Память — только те, кому вы открыли код. Другим людям видно ваше имя (если у вас есть общий код, заказ или вы продаёте в маркете), почта — никогда.", "Платёжный сервис — данные для оплаты. Печать — адрес доставки. Хостинг — хранит данные по нашему поручению. Больше никому не передаём и не продаём."] },
      { h: "Cookies", p: ["Только нужные для работы: вход (подписанная cookie), метка для лимитов от спама. Язык сайта хранится в вашем браузере. Рекламных и аналитических трекеров нет."] },
      { h: "Сколько храним и удаление", p: ["Пока у вас есть аккаунт. Удалили аккаунт в профиле — удаляем коды, память, фото, видео, контакты, уведомления; из резервных копий — в течение 30 дней. Сведения об оплатах храним столько, сколько требует закон."] },
      { h: "Ваши права", p: ["Узнать, что о вас хранится, исправить, удалить, получить копию — напишите нам (раздел «Контакты»)."] },
      { h: "Дети", p: ["Сайт для людей от 16 лет. Если узнаем, что аккаунт создал ребёнок младше, удалим его."] },
      { h: "Безопасность", p: ["Вход через Google и Apple, подписанные cookie, доступ к фото и видео — только по правилам «кто видит». Если узнаем об утечке, сообщим."] },
    ],
  },
  refunds: {
    title: "Возвраты",
    intro: "Если что-то пошло не так — напишите нам, разберёмся по-человечески.",
    sections: [
      { h: "Коды", p: ["14 дней: вернём деньги, если код не читается и мы не смогли это исправить, или если вы купили по ошибке и ещё не скачали и не напечатали код."] },
      { h: "Коллекционные коды и номера", p: ["Покупка в маркете — как у кодов. Покупка у другого человека (аукцион, перепродажа) — без возврата, кроме нашей ошибки: код уже перешёл вам, а деньги — продавцу."] },
      { h: "Заказ под бренд", p: ["До того как дизайнер прислал дизайн — полный возврат. После — по договорённости, в зависимости от сделанной работы."] },
      { h: "Товары", p: ["Брак или не то, что заказали, — заменим или вернём деньги (напишите в течение 14 дней после получения, приложите фото).", "Вещи с вашим кодом сделаны лично для вас, поэтому без брака их не принимаем обратно."] },
      { h: "Как вернуть", p: ["Напишите на почту из раздела «Контакты»: что купили, когда и что случилось. Деньги вернутся тем же способом, которым платили."] },
    ],
  },
};

const en: Record<LegalDoc, Doc> = {
  terms: {
    title: "Terms of use",
    intro: "By using QR Studio you agree to these terms. We wrote them in plain words — if anything is unclear, write to us.",
    sections: [
      { h: "1. What QR Studio is", p: ["A site where you can make a beautiful QR code, put a “memory” behind it (text, photos, videos), decide who sees it, and buy collectible codes, numbers and products with a code. The site operator and its details are in the Contacts section."] },
      { h: "2. Account", p: ["Sign-in is only with Google or Apple. We don’t store passwords.", "You must be 16 or older. You are responsible for what happens in your account.", "You can delete your account any time in your profile — together with your codes, memories, photos and videos."] },
      { h: "3. Your codes and memories", p: ["Everything you upload stays yours. You allow us to store it and show it to the people you opened the code to (everyone, contacts, chosen people or only you).", "A printed code leads to our page — that’s why you can change the memory and access without reprinting. Check that a code scans before printing: the site checks it, but cameras differ."] },
      { h: "4. What’s not allowed", p: ["Scams and fake websites (including via link codes), malware, spam.", "Anything illegal or abusive, other people’s personal data without consent, harassment.", "Other companies’ logos and trademarks without rights — in designs and products for sale.", "We review reports and may block a code or an account. A blocked code shows nothing and leads nowhere."] },
      { h: "5. Purchases", p: ["Your first simple code is free, then prices are as shown on the site (in US dollars). You pay once per code, no subscription: a paid code works as long as the site works.", "Payments are handled by a payment provider acting as reseller; your card details never reach us.", "Refunds follow the Refunds page."] },
      { h: "6. Collectible codes, numbers and auctions", p: ["Editions are limited: a number in an edition (or a number from 1 to 1,000,000) belongs to one person. We keep the ownership registry.", "An auction bid is a commitment to buy if it wins. On a sale we keep a fee (currently 10%).", "A code passes to the buyer without the previous owner’s memory. A collectible is not an investment: we don’t promise its price will rise."] },
      { h: "7. Brands and anti-counterfeit", p: ["A brand is responsible for its products and for who gets its tags. We provide a verification tool and don’t guarantee there will be no fakes."] },
      { h: "8. Products", p: ["Products with your code are printed to order. Timing and delivery are shown at checkout. Defects — we replace or refund."] },
      { h: "9. Liability", p: ["We work to keep the site running, but the service is provided “as is”. We are not liable for indirect losses (for example, a printed batch if the code wasn’t checked before printing).", "If we ever close the service, we’ll warn you in advance and let you download your data."] },
      { h: "10. Changes", p: ["These terms may change. We’ll announce important changes on the site in advance. The update date is at the top of the page."] },
      { h: "11. Other", p: ["QR Code is a registered trademark of DENSO WAVE INCORPORATED.", "Governing law and disputes — per the operator’s place of registration (Contacts section)."] },
    ],
  },
  privacy: {
    title: "Privacy",
    intro: "In short: we collect only what the site needs to work, we don’t sell data and we don’t use advertising trackers. We never show a person’s email to others.",
    sections: [
      { h: "What we store", p: ["Account: name, email and account ID at Google or Apple.", "What you add: codes and their design, memories (text, photos, videos), reminders, contacts, people lists, titles.", "Scans of your codes: time and whether the person was signed in (we don’t store IP addresses).", "“Contact through us”: the message, a reply contact and a location — only if the finder chose to send them.", "Purchases, product orders (name, phone, delivery address), brand orders, bids, reports."] },
      { h: "Why", p: ["To make the site work: show memories to the people you allowed, deliver messages, take payments, print and ship products.", "To protect people: spam limits, report reviews, anti-counterfeit."] },
      { h: "Who sees it", p: ["Memories — only the people you opened the code to. Others can see your name (if you share a code or an order with them, or sell in the market), never your email.", "The payment provider — payment data. Printing — the delivery address. Hosting — stores data on our behalf. We don’t share or sell data to anyone else."] },
      { h: "Cookies", p: ["Only the ones needed to work: sign-in (a signed cookie) and a marker for spam limits. The site language is stored in your browser. No advertising or analytics trackers."] },
      { h: "Retention and deletion", p: ["As long as you have an account. Delete your account in your profile and we delete your codes, memories, photos, videos, contacts and notifications; backups are cleared within 30 days. Payment records are kept as long as the law requires."] },
      { h: "Your rights", p: ["To find out what we store about you, correct it, delete it or get a copy — write to us (Contacts section)."] },
      { h: "Children", p: ["The site is for people aged 16 and over. If we learn an account was created by a younger child, we’ll delete it."] },
      { h: "Security", p: ["Sign-in via Google and Apple, signed cookies, photos and videos available only under the “who sees it” rules. If we learn of a breach, we’ll tell you."] },
    ],
  },
  refunds: {
    title: "Refunds",
    intro: "If something went wrong, write to us and we’ll sort it out fairly.",
    sections: [
      { h: "Codes", p: ["14 days: we refund if a code doesn’t scan and we couldn’t fix it, or if you bought by mistake and haven’t downloaded or printed the code yet."] },
      { h: "Collectible codes and numbers", p: ["Bought in the market — same as codes. Bought from another person (auction, resale) — no refunds except for our error: the code has passed to you and the money to the seller."] },
      { h: "Brand orders", p: ["Before the designer sends the design — full refund. After that — by agreement, depending on the work done."] },
      { h: "Products", p: ["A defect or the wrong item — we replace or refund (write within 14 days of receipt, with a photo).", "Items with your code are made personally for you, so without a defect we can’t take them back."] },
      { h: "How to get a refund", p: ["Email us (Contacts section): what you bought, when and what happened. The money goes back the way you paid."] },
    ],
  },
};

const hy: Record<LegalDoc, Doc> = {
  terms: {
    title: "Օգտագործման պայմաններ",
    intro: "Օգտվելով QR Studio-ից՝ դուք համաձայնում եք այս պայմաններին։ Գրել ենք պարզ բառերով — եթե ինչ-որ բան պարզ չէ, գրեք մեզ։",
    sections: [
      { h: "1. Ինչ է QR Studio-ն", p: ["Կայք, որտեղ կարելի է ստեղծել գեղեցիկ QR կոդ, դրա տակ դնել «հիշողություն» (տեքստ, լուսանկար, տեսանյութ), որոշել, թե ով է այն տեսնում, գնել հավաքածուի կոդեր, համարներ և ապրանքներ կոդով։ Կայքի օպերատորը և նրա տվյալները նշված են «Կոնտակտներ» բաժնում։"] },
      { h: "2. Հաշիվ", p: ["Մուտքը՝ միայն Google-ով կամ Apple-ով։ Գաղտնաբառեր չենք պահում։", "Կայքից կարելի է օգտվել 16 տարեկանից։ Դուք պատասխանատու եք ձեր հաշվում կատարվողի համար։", "Հաշիվը կարելի է ջնջել ցանկացած պահի պրոֆիլում՝ կոդերի, հիշողության, լուսանկարների և տեսանյութերի հետ։"] },
      { h: "3. Ձեր կոդերը և հիշողությունը", p: ["Այն ամենը, ինչ վերբեռնում եք, մնում է ձերը։ Թույլ եք տալիս մեզ պահել այն և ցույց տալ նրանց, ում բացել եք կոդը (բոլորին, կոնտակտներին, ընտրված մարդկանց կամ միայն ձեզ)։", "Տպված կոդը տանում է մեր էջը, ուստի հիշողությունը և մուտքը կարելի է փոխել առանց վերատպման։ Տպելուց առաջ ստուգեք, որ կոդը կարդացվում է. կայքն ինքն է ստուգում, բայց տեսախցիկները տարբեր են։"] },
      { h: "4. Ինչն է արգելված", p: ["Խարդախություն և կեղծ կայքեր (այդ թվում կոդ-հղումով), վնասակար ծրագրեր, սպամ։", "Անօրինական, վիրավորական բովանդակություն, ուրիշի անձնական տվյալներ առանց համաձայնության, հետապնդում։", "Ուրիշի լոգոներ և ապրանքային նշաններ առանց իրավունքի՝ վաճառվող դիզայններում և ապրանքներում։", "Բողոքներով ստուգում ենք կոդերը և կարող ենք արգելափակել կոդը կամ հաշիվը։ Արգելափակված կոդը ոչինչ ցույց չի տալիս և ոչ մի տեղ չի տանում։"] },
      { h: "5. Գնումներ", p: ["Առաջին պարզ կոդն անվճար է, հետո՝ կայքում նշված գնով (ԱՄՆ դոլարով)։ Վճարում եք մեկ անգամ յուրաքանչյուր կոդի համար, առանց բաժանորդագրության. վճարված կոդն աշխատում է, քանի դեռ կայքն աշխատում է։", "Վճարումներն ընդունում է միջնորդ վճարային ծառայությունը. քարտի տվյալները մեզ չեն հասնում։", "Վերադարձներ՝ «Վերադարձներ» էջի կանոններով։"] },
      { h: "6. Հավաքածուի կոդեր, համարներ և աճուրդներ", p: ["Թողարկումը սահմանափակ է. թողարկման համարը (կամ 1-ից 1 000 000 համարը) պատկանում է մեկ մարդու։ Մենք վարում ենք տերերի գրանցամատյանը։", "Աճուրդի խաղադրույքը պարտավորություն է գնելու, եթե այն լավագույնը լինի։ Վաճառքից պահում ենք միջնորդավճար (հիմա՝ 10%)։", "Կոդն անցնում է գնորդին առանց նախորդ տիրոջ հիշողության։ Հավաքածուի կոդը ներդրում չէ. չենք խոստանում, որ դրա գինը կաճի։"] },
      { h: "7. Բրենդներ և պաշտպանություն կեղծիքից", p: ["Բրենդը պատասխանատու է իր ապրանքների և այն բանի համար, թե ում է տալիս պիտակները։ Մենք տալիս ենք ստուգման գործիք և չենք երաշխավորում, որ կեղծիքներ չեն լինի։"] },
      { h: "8. Ապրանքներ", p: ["Ձեր կոդով ապրանքները տպվում են պատվերով։ Ժամկետները և առաքումը՝ ձևակերպման ժամանակ։ Թերություն — կփոխարինենք կամ կվերադարձնենք գումարը։"] },
      { h: "9. Պատասխանատվություն", p: ["Ջանում ենք, որ կայքն աշխատի առանց ընդհատումների, բայց ծառայությունը տրամադրվում է «ինչպես կա»։ Չենք պատասխանատու անուղղակի վնասների համար (օրինակ՝ տպված տիրաժի, եթե կոդը չեն ստուգել տպելուց առաջ)։", "Եթե փակենք ծառայությունը, նախապես կզգուշացնենք և թույլ կտանք ներբեռնել ձեր տվյալները։"] },
      { h: "10. Փոփոխություններ", p: ["Պայմանները կարող են փոխվել։ Կարևոր փոփոխությունների մասին նախապես կզգուշացնենք կայքում։ Թարմացման ամսաթիվը՝ էջի վերևում։"] },
      { h: "11. Այլ", p: ["QR Code-ը DENSO WAVE INCORPORATED-ի գրանցված ապրանքային նշանն է։", "Կիրառելի իրավունքը և վեճերի կարգը՝ ըստ օպերատորի գրանցման վայրի («Կոնտակտներ» բաժին)։"] },
    ],
  },
  privacy: {
    title: "Գաղտնիություն",
    intro: "Կարճ՝ հավաքում ենք միայն այն, ինչ պետք է կայքի աշխատանքի համար, տվյալներ չենք վաճառում և գովազդային հետագծիչներ չենք դնում։ Մարդու փոստը ուրիշներին երբեք ցույց չենք տալիս։",
    sections: [
      { h: "Ինչ ենք պահում", p: ["Հաշիվ՝ անուն, փոստ և հաշվի համար Google-ում կամ Apple-ում։", "Այն, ինչ ինքներդ եք ավելացրել՝ կոդեր և դրանց ձևավորում, հիշողություն (տեքստ, լուսանկար, տեսանյութ), հիշեցումներ, կոնտակտներ, մարդկանց ցուցակներ, անուններ։", "Ձեր կոդերի սկանները՝ ժամանակը և արդյոք մարդը մուտք էր գործել (IP հասցեն չենք պահում)։", "«Կապ մեր միջոցով»՝ հաղորդագրության տեքստը, պատասխանի կոնտակտը և վայրը՝ միայն եթե գտնողն ինքն է որոշել ուղարկել։", "Գնումներ, ապրանքների պատվերներ (անուն, հեռախոս, առաքման հասցե), բրենդների պատվերներ, խաղադրույքներ, բողոքներ։"] },
      { h: "Ինչի համար", p: ["Որպեսզի կայքն աշխատի՝ ցույց տալ հիշողությունը նրանց, ում բացել եք կոդը, առաքել հաղորդագրությունները, ընդունել վճարումներ, տպել և առաքել ապրանքները։", "Մարդկանց պաշտպանելու համար՝ սպամի սահմանափակումներ, բողոքների ստուգում, պաշտպանություն կեղծիքից։"] },
      { h: "Ով է տեսնում", p: ["Հիշողությունը՝ միայն նրանք, ում բացել եք կոդը։ Ուրիշներին երևում է ձեր անունը (եթե ունեք ընդհանուր կոդ, պատվեր կամ վաճառում եք շուկայում), փոստը՝ երբեք։", "Վճարային ծառայությունը՝ վճարման տվյալները։ Տպագրությունը՝ առաքման հասցեն։ Հոսթինգը՝ պահում է տվյալները մեր հանձնարարությամբ։ Ուրիշ ոչ մեկին չենք փոխանցում և չենք վաճառում։"] },
      { h: "Cookies", p: ["Միայն աշխատանքի համար անհրաժեշտները՝ մուտք (ստորագրված cookie), սպամի սահմանափակման նշան։ Կայքի լեզուն պահվում է ձեր դիտարկիչում։ Գովազդային և վերլուծական հետագծիչներ չկան։"] },
      { h: "Որքան ենք պահում և ջնջում", p: ["Քանի դեռ ունեք հաշիվ։ Ջնջեցիք հաշիվը պրոֆիլում — ջնջում ենք կոդերը, հիշողությունը, լուսանկարները, տեսանյութերը, կոնտակտները, ծանուցումները, պահուստային պատճեններից՝ 30 օրվա ընթացքում։ Վճարումների մասին տեղեկությունները պահում ենք օրենքով պահանջվող ժամկետով։"] },
      { h: "Ձեր իրավունքները", p: ["Իմանալ, թե ինչ է պահվում ձեր մասին, ուղղել, ջնջել, ստանալ պատճեն — գրեք մեզ («Կոնտակտներ» բաժին)։"] },
      { h: "Երեխաներ", p: ["Կայքը 16 տարեկանից բարձր մարդկանց համար է։ Եթե իմանանք, որ հաշիվը ստեղծել է ավելի փոքր երեխա, կջնջենք այն։"] },
      { h: "Անվտանգություն", p: ["Մուտք Google-ով և Apple-ով, ստորագրված cookie-ներ, լուսանկարներն ու տեսանյութերը՝ միայն «ով է տեսնում» կանոններով։ Եթե իմանանք արտահոսքի մասին, կտեղեկացնենք։"] },
    ],
  },
  refunds: {
    title: "Վերադարձներ",
    intro: "Եթե ինչ-որ բան սխալ գնաց — գրեք մեզ, մարդավարի կլուծենք։",
    sections: [
      { h: "Կոդեր", p: ["14 օր. կվերադարձնենք գումարը, եթե կոդը չի կարդացվում, և մենք չկարողացանք դա ուղղել, կամ եթե գնել եք սխալմամբ և դեռ չեք ներբեռնել ու տպել կոդը։"] },
      { h: "Հավաքածուի կոդեր և համարներ", p: ["Շուկայից գնումը՝ ինչպես կոդերինը։ Ուրիշ մարդուց գնումը (աճուրդ, վերավաճառք)՝ առանց վերադարձի, բացի մեր սխալից. կոդն արդեն անցել է ձեզ, իսկ գումարը՝ վաճառողին։"] },
      { h: "Պատվեր բրենդի համար", p: ["Մինչև դիզայները կուղարկի դիզայնը՝ ամբողջական վերադարձ։ Դրանից հետո՝ պայմանավորվածությամբ, կախված կատարված աշխատանքից։"] },
      { h: "Ապրանքներ", p: ["Թերություն կամ սխալ ապրանք — կփոխարինենք կամ կվերադարձնենք գումարը (գրեք ստանալուց 14 օրվա ընթացքում, կցեք լուսանկար)։", "Ձեր կոդով իրերը պատրաստված են անձամբ ձեզ համար, ուստի առանց թերության հետ չենք ընդունում։"] },
      { h: "Ինչպես վերադարձնել", p: ["Գրեք «Կոնտակտներ» բաժնի փոստին՝ ինչ եք գնել, երբ և ինչ է պատահել։ Գումարը կվերադառնա նույն եղանակով, որով վճարել եք։"] },
    ],
  },
};

const BY_LANG: Record<BaseLang, Record<LegalDoc, Doc>> = { ru, en, hy };
/** Документы на языке человека; где перевода пока нет — английский. */
export const legalFor = (lang: Lang) => BY_LANG[lang as BaseLang] ?? BY_LANG.en;
export const LEGAL_RU = ru;
