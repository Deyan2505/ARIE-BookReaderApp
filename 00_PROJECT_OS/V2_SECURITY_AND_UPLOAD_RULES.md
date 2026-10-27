# V2 Security and Upload Rules — ARIE BookReaderApp

> Създаден: 2026-07-19. Задължителни правила за Phase 2 (Auth), Phase 3 (Upload)
> и Phase 5 (Storage reliability). Нарушение на което и да е правило блокира deploy.

---

## 1. Принципи

1. Публичният читател НИКОГА не се логва. Read остава анонимен.
2. Само авторът (или изрично allowlisted администратор) може да качва, редактира
   метаданни, публикува, архивира или заменя книга.
3. Скриването на бутон с CSS/JS **не е защита**. Всяка write операция се оторизира
   **server-side** при всяко извикване.
4. Съдържанието на книгите е окончателно. Upload потокът пренася текста 1:1 —
   никаква нормализация, „поправки", преномериране или съкращаване.

## 2. Authentication (Phase 2)

- Supabase Auth, email + парола, само за авторския акаунт.
- **Allowlist** (admin email/user id) се проверява в Netlify функцията на всяка admin
  заявка — не само в RLS и никога само в frontend.
- Session: supabase-js access token; изпраща се като `Authorization: Bearer` към admin
  endpoints; функцията валидира токена срещу Supabase и после проверява allowlist.
- Logout бутон + автоматичен token expiry; изтекла сесия скрива админ UI и връща 401.
- Не се пази парола/токен в код, Git, logs или доклади.

## 3. Keys и secrets

| Ключ | Къде живее | Къде е ЗАБРАНЕН |
|---|---|---|
| SUPABASE_URL, SUPABASE_ANON_KEY | Netlify env (+ browser: anon key е публичен по дизайн, но при нас клиентът говори само с нашето API — не е нужен в bundle-а) | Git |
| SUPABASE_SERVICE_ROLE_KEY | САМО Netlify env, използван само в функцията | browser bundle, Git, logs, доклади |
| ENCRYPTION_SALT | api.js (съществуващ, не се променя в началните фази) | — |

QA gate: grep на build output за `service_role`/ключови префикси преди всеки deploy.

## 4. RLS (Supabase)

- `books`: анонимен `SELECT` само където `status='published'`; `INSERT/UPDATE/DELETE`
  само за allowlisted admin uid. Draft/archived редове са невидими за анонимни заявки.
- Storage `book-originals`: private (само service role / admin).
- Storage `covers`: public read, write само admin.

## 5. Upload валидация (Phase 3/5)

| Проверка | Правило |
|---|---|
| Типове книга | MVP: `.txt` (text/plain). `.docx` едва след пълния Phase 4 чеклист |
| Типове корица | png/jpg/webp; MIME + magic bytes проверка server-side |
| Максимален размер | книга ≤ 5 MB текст; корица ≤ 3 MB (конфигурируеми константи) |
| Slug | автоматично предложение от заглавието (транслитерация), редактируем; `^[a-z0-9-]+$`; **проверка за дубликат преди запис**; след публикуване id е неизменимо |
| Filename sanitization | оригиналното име не се използва като път; уникален storage path `<slug>/<timestamp>_<sanitized>` |
| Encoding | UTF-8 задължително; проверка, че кирилицата оцелява (round-trip тест на preview) |

## 6. Надеждност на публикуването (Phase 5)

1. Редът на операциите: draft запис → качване на файлове → preview → изричен publish.
   `status='published'` се задава ПОСЛЕДЕН, само ако всичко останало е успяло.
2. Частичен неуспех (напр. корицата не се качи) ⇒ книгата остава draft; нищо непълно
   не става публично; UI показва грешка + retry.
3. Замяна на файл: нов storage path, после атомарен UPDATE на реда, после старият файл
   се маркира за изтриване — без прозорец, в който книгата сочи несъществуващ файл.
4. Orphan контрол: периодична проверка Storage срещу `books`; файлове без ред → доклад
   (не автоматично триене).
5. Rollback: publish е обратим (връщане в draft/archived); Netlify deploy rollback е
   отделен и документиран във V2_QA_CHECKLIST.md.

## 7. Какво е изрично забранено

- Публичен file input, който пише директно в repo или Storage без auth + server-side
  authorization.
- Admin endpoint, който вярва на параметър/флаг от клиента за роля.
- Каквато и да е редакция на текст на книга по време на upload.
- Излагане на env стойности в отговори, грешки или логове (само имена + configured/missing).
