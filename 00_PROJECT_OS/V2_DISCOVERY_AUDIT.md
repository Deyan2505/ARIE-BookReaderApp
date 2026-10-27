# V2 Discovery Audit — ARIE BookReaderApp

> Дата на одита: 2026-07-19
> Одитът е изцяло read-only. Никакви проектни файлове не са променяни.
> Всяко заключение по-долу има конкретно доказателство (команда, HTTP response, screenshot или code reference).

---

## 1. Локализация на проекта

| Параметър | Стойност | Доказателство |
|---|---|---|
| Project root | `C:\Users\deianarie306\OneDrive - Tel-Aviv University\ПРЕДИЗВИКАТЕЛСТВА\Предизвикателство 4\BookReaderApp` | `git rev-parse --show-toplevel` |
| Git remote | `https://github.com/Deyan2505/ARIE-BookReaderApp.git` (fetch + push) | `git remote -v` |
| Branch | `main`, upstream `origin/main` | `git branch -vv` |
| HEAD | `d07f172` — "Phase 2A — Render real book covers in Library" (2026-06-29 21:03 +0300) | `git log` |
| Remote HEAD | `d07f172e22e...` — идентичен с локалния | `git ls-remote origin main` |
| Working tree | Чист — 0 modified, 0 staged, 0 untracked | `git status --short` |
| История | Само 2 commit-а: `4e8f712` (initial) и `d07f172` (Phase 2A), двата от 2026-06-29 | `git log --oneline` |

Бележка: пътят в заданието сочеше потребител `deian`; реалният Windows потребител е
`deianarie306`. Remote-ът и съдържанието доказват, че това е същият проект.

⚠ Проектът (вкл. `.git/` и `node_modules/`) живее в OneDrive-синхронизирана папка с
кирилско име. Това работи, но е известен риск (OneDrive lock/sync срещу `.git`), отбелязан
в риск-регистъра на V2_MASTER_PLAN.md.

---

## 2. Netlify deployment (проверено през автентикиран Netlify CLI, read-only)

| Параметър | Стойност |
|---|---|
| Site | `arie-bookreaderapp`, ID `baea77c9-4782-4cb2-9855-29c00c5042ec` |
| URL | https://arie-bookreaderapp.netlify.app |
| Свързано repo | `Deyan2505/ARIE-BookReaderApp`, branch `main` |
| Build command | (няма — статичен publish) |
| Publish dir | `public` |
| Functions dir | `netlify/functions` |
| Published deploy | `d07f172` (= локалния и GitHub HEAD), state `ready`, 2026-06-29T18:03Z |
| Deploy история | Общо 2 deploy-а — 4e8f712 (17:56Z) и d07f172 (18:03Z), и двата успешни |
| Environment variables | **Нула конфигурирани.** `SUPABASE_URL`: missing, `SUPABASE_ANON_KEY`: missing, `SUPABASE_SERVICE_ROLE_KEY`: missing |

Извод: production работи в **catalog/local-fallback режим** (клонът `useLocalFallback` в
`netlify/functions/api.js:14`). Supabase не участва в production. Никакви secrets не
съществуват в repo-то (няма `.env` файлове; `.gitignore` ги изключва).

---

## 3. Production endpoint резултати (2026-07-19)

| Endpoint | Статус | Резултат |
|---|---|---|
| `/` | 200, `text/html`, 9880 B | Байт-идентичен с локалния `public/index.html` (MD5) |
| `/js/reader.js`, `/js/smoke.js`, `/css/styles.css` | 200 | И трите байт-идентични с локалните (MD5) |
| `/api/books` | 200, JSON | Масив с **1 книга**: `paradoksat-na-bolkata`, пълни метаданни, cover path |
| `/api/books/paradoksat-na-bolkata/read` | 200, JSON | `totalPages: 232`, валиден `meta` ключ |
| `/api/books/paradoksat-na-bolkata/page/1` | 200 | Декриптира се коректно до `##COVER##` (проверено с локална XOR декрипция) |
| `/api/books/paradoksat-na-bolkata/page/2` | 200, 2437 B | Идентичен байт-по-байт с локалния отговор |
| `/api/books/<несъществуваща>/read` | 404 | `"Книгата не е намерена локално!"` — това е съобщението от **fallback клона**, не от Supabase клона → доказва активния режим |
| `/covers/paradoksat-na-bolkata.png` | 200, `image/png`, 2 429 508 B | Реалната корица се сервира |
| `/read/paradoksat-na-bolkata` | 200, HTML | SPA redirect от `netlify.toml` работи |

## 4. Браузърна проверка на production (Chromium, desktop 1280×720 + mobile 375×812)

- Библиотеката рендерира картата на „Парадоксът на болката" с **реалната корица**, автор „Деян Арие", бутон „Започни четенето". (screenshot в сесията на одита)
- Кликът отваря четеца: Canvas cover страница → навигация към стр. 2 рендерира декриптиран кирилски текст („Съдържание", глави) с ARIE watermark.
- **Нула console errors** на всички екрани.
- Mobile: layout коректен; след четене секция „Последно отворени" се появи с прогрес „1% · стр. 2 от 232" → `arie_p_<bookId>` и `arie_recent` в localStorage работят в production.
- Empty-state елементът („Библиотеката е празна") присъства в DOM, но е скрит — показва се само при празен отговор от API (`reader.js:238-241`).

---

## 5. Проверка на деветте хипотези за „празната библиотека“

| # | Хипотеза | Присъда | Доказателство |
|---|---|---|---|
| 1 | Netlify има Supabase variables → API прескача catalog.json | **Rejected** | Netlify env: нула променливи; 404 текстът е от fallback клона |
| 2 | Supabase `books` е празна / schema не съответства | **Rejected като причина** (Supabase изобщо не е активен в production). Отделно **Confirmed като латентен риск**: Supabase клонът на api.js избира само `id,title,size_bytes,uploaded_at`/`content` — без subtitle/cover/series/status → включване на Supabase env vars днес би „изпразнило“/осакатило библиотеката | `api.js:176-191, 216-229`; няма Supabase credentials никъде локално |
| 3 | Production не е от последния commit на `main` | **Rejected** | Published deploy `commit_ref = d07f172` = HEAD; 4-те frontend файла MD5-идентични |
| 4 | `data/` или `uploads/` не са в function bundle | **Rejected** | `/read` връща 232 страници → функцията чете `uploads/1_Paradoksat-na-bolkata.txt` през catalog entry |
| 5 | `netlify.toml` включва само първата книга | **Confirmed като факт и бъдещ риск, не като текуща повреда** | `included_files = ["data/**", "uploads/1_Paradoksat-na-bolkata.txt", "uploads/1_Paradoksat-na-bolkata.json"]` — нова книга в `uploads/` няма да влезе в bundle-а без редакция на toml |
| 6 | API redirect не работи | **Rejected** | `/api/books` → 200 JSON през `/.netlify/functions/api/:splat` |
| 7 | Runtime error в Netlify Function | **Rejected** | Всички function endpoints връщат 200/коректен 404; никакви 5xx |
| 8 | Frontend получава празен масив и правилно показва empty state | **Rejected** | `/api/books` връща 1 книга; DOM съдържа рендерираната карта |
| 9 | Cover path / asset deployment неправилен | **Rejected** | 200, image/png, 2.4 MB, рендерира се в браузъра |

## 6. Установен root cause

**Твърдението „production библиотеката се показва празна“ НЕ се възпроизвежда към 2026-07-19.**
Production е напълно работещ end-to-end (списък → корица → отваряне → декрипция →
навигация → прогрес), с нула console errors.

Исторически: празна/счупена библиотека е съществувала **преди 2026-06-29** — документирана
в `current_status.md` (Phase 0): TDZ бъг (`route()` извикан преди инициализация на
`let allBooks`/`libraryLoaded`) + malformed файл в filesystem-scan режима. Тези дефекти са
поправени в кода, който е в production от 2026-06-29 (единствените 2 deploy-а). След тази
дата не е имало нито един deploy, а всичките 9 хипотези за текуща повреда са тествани
отрицателно. Най-вероятни обяснения за по-скорошно наблюдение на „празна библиотека“:
кеширана стара сесия в браузъра или гледан друг/стар сайт (в Netlify акаунта има 33 сайта).

**Следствие: Phase 0 „Recovery“ не изисква никаква промяна по кода.** Възстановяването е
фактически завършено и верифицирано; базовата линия е commit `d07f172`.

---

## 7. Вторични проблеми, открити при одита (не са пипани)

1. **[Латентен, висок]** Supabase клонът на `api.js` е schema-остарял спрямо каталожния модел (виж хипотеза 2). Ако някой зададе Supabase env vars, production ще регресира. Трябва да се приведе в паритет преди каквато и да е Supabase активация (V2 Phase 1).
2. **[Бъдещ, среден]** `netlify.toml` included_files е hardcoded за една книга — всяка нова книга изисква редакция (докато книгите живеят в Git). Фиксира се с glob `uploads/**` или с миграция към Supabase.
3. **[Информационен]** `uploads/1780343541579___…_1_.txt` (543 KB, gitignored) — ранен експорт на същата книга с артефакти („Корица", дублирано „Съдържание"). Не участва в production (каталогът е авторитетен). Да не се трие без решение на автора.
4. **[Информационен]** `mammoth` е в devDependencies, но **не се използва никъде в кода** (0 require/import) — кандидат за DOCX поддръжка във V2 Phase 4.
5. **[Малък]** Корицата е 2.4 MB PNG — тежка за mobile; кандидат за оптимизация (V2 Phase 6), без да се променя файлът-оригинал.
6. **[Малък]** `paginateText()` чете и пагинира цялата книга при всяка заявка за страница — O(книга) на страница. Приемливо при 1 книга; да се преоцени при повече/по-големи книги.
7. **[Dev-only]** `npm start` (= `netlify dev`) има странични ефекти: добавя `.netlify` ред в `.gitignore`, създава `.netlify/`, тегли Deno Edge среда (минути). `node server.js` (както в `.claude/launch.json`) е бързият, чист dev режим. Двата режима НЕ са еквивалентни.
8. **[Информационен]** Font Awesome се зарежда от CDN (`index.html:7`) — външна runtime зависимост.
9. **[Информационен]** `.netlify/state.json` не съществуваше преди одита; папката не е линкната към сайта (CLI работи през site ID). Линкване е желателно, но е промяна на състояние → изисква одобрение.

## 8. Локално срещу production (Етап 3)

- `node server.js` на порт 3101 (порт 3001 е зает от **друго** приложение на машината — redirect към `/login`, не е ARIE): `/api/books`, `/read`, `/page/2`, `/`, cover — **байт-идентични** с production.
- `npm start` (`netlify dev`): стартира, зарежда функцията `api`, но Edge setup блокира порта минути; страничните ефекти са описани в т. 7.3. Верифицираният dev режим е `node server.js`.
- Временният локален сървър беше спрян; страничните ефекти на `netlify dev` (`.gitignore` ред, `.netlify/`) бяха върнати → working tree отново чист.

## 9. Статус на съществуващите документи в 00_PROJECT_OS/

| Документ | Статус към 2026-07-19 |
|---|---|
| `book_reader_master_plan.md` | Частично остарял: Phase 1 (каталог) и Phase 2A (реални корици) са реално **изпълнени и в production**, но са отбелязани като предстоящи. Phase 6 (Make.com/Airtable) се **заменя** от V2 upload посоката (Supabase). Всичко останало (идентичност, защита, canvas, routing) е актуално. |
| `current_status.md` | Актуален към 2026-06-29; вече не отразява, че каталогът и кориците са deploy-нати. |
| `decision_log.md` | Актуален; решенията (canvas, XOR, hash routing, catalog като source of truth, author-owned) остават в сила. Решението „No upload endpoint is needed“ се **преразглежда** от V2 (авторски, не публичен upload). |
| `feature_tracker.md` | Остарял по статуси: Phase 1 и Phase 2 (корици) са реално Done. |
| `working_rules.md` | Изцяло актуален; V2 работи по същите правила. |

Старите документи НЕ са променяни и НЕ се трият — те остават исторически запис.
Актуалният план е в `V2_MASTER_PLAN.md`.
