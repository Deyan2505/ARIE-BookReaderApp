# V2 Master Plan — ARIE BookReaderApp (авторско качване на книги)

> Създаден: 2026-07-19, след пълния read-only одит (виж `V2_DISCOVERY_AUDIT.md`).
> Този документ е актуалният план. Старите документи в `00_PROJECT_OS/` остават
> исторически запис; кое от тях е остаряло е описано в одита, раздел 9.
> Правилата от `working_rules.md` важат изцяло и за V2.
> **Нито една фаза не започва без изрично одобрение от автора.**

---

## Цел на V2

Публичната библиотека и четецът остават каквито са (стабилни, верифицирани в production).
V2 добавя: защитен авторски вход, бутон „Качи книга" само за администратора и надежден
поток за публикуване на нови готови книги без ръчна редакция на код.

## Какво НЕ се променя (наследени забрани, препотвърдени)

- Canvas rendering, XOR encrypt/decrypt, `ENCRYPTION_SALT`, `public/js/smoke.js`
- Hash routing (`#/library`, `#/read/:id`), progress ключове `arie_p_<bookId>`, recent books
- Текстовете на книгите (окончателни; никаква редакция/преномерация)
- ARIE визуална идентичност, защита срещу копиране, watermark, теми, шрифт, fullscreen
- Никакви secrets във frontend, Git, logs или доклади

---

## Phase 0 — Recovery and baseline  ✅ ЗАВЪРШЕНА (верификация, без промяна на код)

Одитът от 2026-07-19 доказа:
- Root cause на „празната библиотека": **не съществува текущ дефект**. Историческият дефект
  (TDZ бъг + filesystem scan) е поправен и deploy-нат на 2026-06-29. Деветте хипотези —
  тествани, всички отрицателни (одит, раздел 5).
- Production (`d07f172`) = GitHub `main` = локалният код, байт-идентично.
- Local (`node server.js`) и production поведение — идентични на всички endpoints.
- Production QA: библиотека, корица, отваряне, декрипция, навигация, прогрес, mobile — работят.
- Working tree чист; никакъв recovery commit не е необходим.

**Изход:** Baseline = commit `d07f172`. Phase 0 не създава код.

---

## Phase 0A — Lossless Reader Pagination Recovery  🛑 БЛОКИРАЩА (добавена 2026-07-19)

**Статус:** Root cause доказан; имплементацията чака одобрение.
**Блокира:** Phase 1, 2, 3 и всяка upload работа, докато не премине QA.

Открит е критичен дефект: сървърът реже книгата на ~1200-знакови chunk-а без знание за
canvas/шрифт/viewport, а `wrapText()` в четеца спира да рисува при `maxY` и **изхвърля
непобралия се остатък** — той никога не се показва. Измерено на реалната книга: при шрифт
по подразбиране (20) се губят **39–79% от текста** според устройството; при малък шрифт на
голям екран се появяват огромни празни области (до 148/231 страници).

Пълните доказателства, архитектурният анализ, дизайнът на решението (client-side visual
pagination с offset-базиран прогрес), миграцията на прогреса и conservation тестовете са в:
`00_PROJECT_OS/V2_PHASE0A_PAGINATION_DEFECT.md`.

Изисквано крайно състояние: всеки знак от reader-ready съдържанието се показва точно
веднъж, без липси, без дубликати, в правилен ред, при всички размери на екран и шрифт.
Canvas rendering, водният знак, XOR механизмът и визуалната идентичност се запазват.

---

## Phase 1 — Canonical book data architecture

**Цел:** един официален source of truth, готов за upload workflow.
**Решение (предложено, чака одобрение):** Supabase (Database + Storage) за production;
`data/catalog.json` + `uploads/` остават dev fallback. Пълният анализ на трите опции е в
`V2_ARCHITECTURE.md`.

Задачи:
1. Supabase schema `books` с пълния метамодел (id/slug, title, subtitle, author, description,
   series*, category, language, status draft|published|archived, cover_path, content, format,
   created_at/updated_at/published_at). Самостоятелните книги нямат изкуствена поредица.
2. Привеждане на Supabase клона в `netlify/functions/api.js` в **пълен паритет** с каталожния
   клон (същите полета, същия филтър `status = 'published'`). Това елиминира латентния риск
   от одита (раздел 7.1) — днес активиране на Supabase би счупило библиотеката.
3. Миграция на „Парадоксът на болката" със **същото id** `paradoksat-na-bolkata`
   (прогресът на читателите зависи от стабилното id).
4. `netlify.toml`: `included_files` → glob (`uploads/**`), за да не изисква редакция при
   нови книги, докато fallback режимът съществува.
5. RLS: публичен SELECT само върху published (детайли във V2_SECURITY_AND_UPLOAD_RULES.md).

Файлове: `netlify/functions/api.js`, `netlify.toml`, нов `00_PROJECT_OS/`-документ със schema-та.
Изход: production чете от Supabase идентично на днешното поведение; localhost без env vars
продължава да работи от каталога.

## Phase 2 — Secure author authentication

- Supabase Auth (email + парола) само за автора; **allowlist по user id/email, проверяван
  server-side** в Netlify функцията при всяка write заявка. Скриване на UI с CSS/JS не е защита.
- Public read остава без login. Admin session: supabase-js token, logout, автоматичен expiry.
- RLS: INSERT/UPDATE/DELETE само за allowlisted admin. `SUPABASE_SERVICE_ROLE_KEY` — само
  в Netlify env, никога в браузъра или Git.

## Phase 3 — Upload workflow („Качи книга")

- Бутон в lib-header, рендериран само при валидна admin session; не пречи на търсенето и mobile.
- Поток: файл → корица → метаданни (заглавие, подзаглавие?, автор по подразбиране „Деян Арие",
  описание, език, категория, поредица?, позиция?) → автоматичен slug + проверка за дубликат →
  preview в реалния четец → draft save → изричен publish → потвърждение → книгата се появява
  в библиотеката без редакция на код.
- Всичко минава през server-side authorization; никакъв публичен file input към Storage/repo.

## Phase 4 — Supported source formats

- MVP: `.txt` (доказан от текущия reader).
- `.docx` през `mammoth` (вече в devDependencies, неизползван) — обявява се за поддържан
  само след пълния чеклист: кирилица, заглавия, абзаци, диалози, празни редове, специални
  символи, много дълги книги, гаранция за нулева редакция на текста, preview преди publish.
- PDF/EPUB — отделни бъдещи фази (текущият код няма поддръжка).

## Phase 5 — Storage and publishing reliability

- Buckets: оригинален файл, reader-ready content, корици; максимален размер; MIME whitelist;
  filename sanitization; уникални пътища; rollback при частичен неуспех; draft vs published;
  замяна; архивиране; без orphan файлове. Детайли във V2_SECURITY_AND_UPLOAD_RULES.md.

## Phase 6 — Library improvements

- Групиране по поредици + самостоятелни книги; „Продължи четенето"; търсене; real covers +
  fallback; empty/error/loading states; admin-only контроли; responsive; оптимизация на
  тежката корица (2.4 MB) без промяна на оригинала.

## Phase 7 — QA, deployment and recovery

- Пълният задължителен чеклист е във `V2_QA_CHECKLIST.md` (публичен посетител не може да
  качва; 401/403 за неавтентикирани write заявки; дубликати/oversize/невалиден тип отхвърлени;
  draft не се вижда публично; съществуващата книга непроменена; прогресът оцелява; никакви
  secrets в client JS/Git; документиран rollback).

---

## Рискове (регистър)

| Риск | Тежест | Мярка |
|---|---|---|
| Активиране на Supabase env vars преди schema паритет | Висок | Phase 1 т.2 се прави и тества ПРЕДИ да се задават env vars |
| Смяна на book id при миграция → загубен читателски прогрес | Висок | Твърдо правило: id-тата са неизменими |
| Service-role key изтичане към frontend | Критичен | Ключът живее само в Netlify env; code review + QA проверка |
| OneDrive синхронизация върху `.git`/`node_modules` (кирилски път) | Среден | Наблюдение; при проблеми — изключване на папката от sync (решение на автора) |
| `netlify dev` странични ефекти (.gitignore/.netlify) | Малък | Документирано; dev режимът е `node server.js` |
| Тежки function отговори при повече/по-големи книги (`paginateText` O(книга)/страница) | Среден | Преоценка в Phase 5 (кеширане на пагинацията) |
| Netlify deploy на счупен междинен стадий | Среден | Работа само в branch; deploy само след изрично одобрение |

## Git и deploy дисциплина

- Всяка фаза — отделен branch, малки commit-и, `node --check` на всеки JS файл, preview
  верификация, production QA след deploy. Commit/push/deploy — само след изрично одобрение.
- Rollback: Netlify „Publish deploy" към предишния ready deploy (двата съществуващи deploy-а
  са изброени в одита) + `git revert` на съответния commit.
