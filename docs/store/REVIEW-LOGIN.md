# Вход проверяющих App Store и Google Play (09.10.2026)

Apple (правило 2.1) и Google (Policy → App content → App access) требуют, чтобы проверяющий сам вошёл в приложение.
Демо-вход к запуску выключаем (`DEMO_LOGIN=off`), а вход через Apple или Google просит личный аккаунт проверяющего —
поэтому есть отдельный вход по логину и коду, как в BookTime (`booking-platform/docs/store/review-notes.md`).

## Как работает

- Env на сайте: `REVIEW_LOGIN` (логин) и `REVIEW_LOGIN_CODE` (код, не короче 8 знаков). Оба заданы — вход включён;
  пусто хотя бы одно или код короче — выключен, а уже вошедший аккаунт проверки перестаёт открываться.
- Где: в приложении «Аккаунт» → «Войти на qrspace.co» → внизу **«Вход по коду проверки»** → логин и код → обратно в
  приложение, сразу «Мои QR-коды». На сайте (обычный `/login`) этой формы нет — только на входе из приложения.
- Аккаунт «App Review» — обычный аккаунт, не демо. В нём сразу три кода со сканами за 30 дней: «Website» (ссылка),
  «Guest Wi‑Fi» и «Welcome note» (код с памятью). Покупки в приложении у проверяющих — тестовые (Sandbox / тестер
  Google), сервер записывает их без выручки. Можно удалить аккаунт (Apple это проверяет) — следующий вход по коду
  заведёт его заново с примерами.
- Подбор: 5 неверных попыток с одного адреса за 15 минут — дальше отказ даже с верным кодом. Логин — без учёта
  регистра и пробелов по краям.
- Код: `src/server/review.ts`, `src/app/api/auth/review/route.ts`, форма — `src/components/LoginPage.tsx`;
  проверка — `e2e/review.mjs`.

## Что сделать владельцу перед отправкой

Логин и код уже созданы: файл **`~/.qrspace/review-login.env`** на этом Mac (вне git, никуда не выкладывать).

1. **Vercel** — сделано 09.10.2026: `REVIEW_LOGIN` и `REVIEW_LOGIN_CODE` из этого файла добавлены в проект `qrspace`
   (Production, Sensitive), работают со следующей выкладки. Поменяли код в файле — поменяйте и там (Settings →
   Environment Variables) и выложите заново. Проверка: в приложении «Войти на qrspace.co» → внизу «Вход по коду
   проверки».
2. **App Store Connect** → версия → App Review Information → **Sign-In required** ✓ → User name = `REVIEW_LOGIN`,
   Password = `REVIEW_LOGIN_CODE`. Если отправляете через fastlane — заполнится само:
   `node apps/ios/fastlane/metadata.mjs` берёт их из того же файла (`review_information/demo_user.txt`,
   `demo_password.txt` — в `.gitignore`). Текст заметок — `apps/ios/fastlane/metadata.mjs` → `REVIEW_NOTES`.
3. **Play Console** → Policy → App content → **App access** → «All or some functionality is restricted» → Add
   instructions: Name «Review account», Username = `REVIEW_LOGIN`, Password = `REVIEW_LOGIN_CODE`, Any other
   information: «Account tab → Sign in on qrspace.co → at the bottom "Sign in with a review code"».

После одобрения вход можно оставить: проверяющие приходят с каждым обновлением. Код утёк — поменяйте его в файле,
в Vercel и в обоих магазинах.
