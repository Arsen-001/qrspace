# Анкеты о данных в магазинах (09.10.2026)

Ответы для App Store («App Privacy» / Privacy Nutrition Labels) и Google Play («Data safety»). Основа — раздел
«Конфиденциальность» на сайте (`src/lib/legal.ts`). Поменялось, что собираем, — поправьте и здесь, и там.

Ссылка на политику: `https://qrspace.co/legal/privacy`. Удаление аккаунта: в приложении (Кабинет → Удалить аккаунт)
и на сайте (`/account?tab=settings`).

## Что собираем (и зачем)

| Данные | App Store | Google Play | Связаны с человеком | Зачем |
|---|---|---|---|---|
| Имя, почта (аккаунт Google/Apple) | Contact Info → Name, Email Address | Personal info → Name, Email address | да | работа приложения (вход, «кто видит») |
| Номер аккаунта | Identifiers → User ID | Personal info → User IDs | да | работа приложения |
| Фото и видео под кодом | User Content → Photos or Videos | Photos and videos | да | работа приложения (память под кодом) |
| Тексты под кодом, сообщения «связь через нас», названия кодов | User Content → Other User Content | Messages → Other in-app messages; App activity → Other user-generated content | да | работа приложения |
| Покупки (коды, пакеты, место) | Purchases → Purchase History | Financial info → Purchase history | да | работа приложения (что оплачено) |
| Сканы наших кодов (время, вошёл ли человек) | Usage Data → Product Interaction | App activity → App interactions | да | работа приложения (статистика сканов владельцу) |
| Место — только если нашедший сам отправил его хозяину | Location → Precise Location (необязательно) | Location → Precise location (optional) | да | работа приложения |
| Адрес телефона для уведомлений (APNs / FCM) и язык | Identifiers → Device ID | Device or other IDs | да | работа приложения (уведомления) |
| Android: диагностика Google ML Kit (модель телефона, версия, ошибки; без кадров камеры) | — (только Android) | App info and performance → Diagnostics; Device or other IDs | нет | аналитика (работа сканера) — собирает Google |

## Чего нет

- **Отслеживания (tracking) нет:** не делимся данными с рекламными сетями и брокерами, рекламы нет → в App Store
  «Data Used to Track You» — пусто, App Tracking Transparency не нужен.
- **Камера** — только чтобы прочитать код, кадры не уходят с телефона (не «сбор»).
- **История сканов** — только на телефоне (не «сбор»).
- Контакты телефона, здоровье, финансовые данные карт (оплату примет платёжный сервис), браузинг — не собираем.

## Google Play — общие вопросы

- Данные шифруются при передаче: **да** (только HTTPS).
- Можно запросить удаление: **да** — в приложении и на сайте; из резервных копий — до 30 дней.
- Передача третьим лицам (sharing): **нет** — хостинг (Vercel, Railway) и Apple/Google для уведомлений обрабатывают
  данные по нашему поручению (это не «sharing» по правилам Play).
- Приложение для детей: **нет**, с 16 лет.

## Перед отправкой в магазины

- Выключить демо-вход (`DEMO_LOGIN=off`) и подключить настоящую оплату.
- Покупки внутри приложения: цифровые товары (коды, место) — правила Apple 3.1.1 и Google Play Billing требуют
  их встроенную оплату (комиссия 15–30%) — решение владельца: продавать в приложении или только на сайте.
