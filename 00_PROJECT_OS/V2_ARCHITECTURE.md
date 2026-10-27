# V2 Architecture — ARIE BookReaderApp

> Създаден: 2026-07-19. Отразява РЕАЛНОТО текущо състояние (верифицирано в одита)
> и целевата архитектура за авторското качване.

---

## 1. Текуща архитектура (as-is, production към 2026-07-19)

```
Читател (browser)
  │  hash routing: #/library, #/read/:id          localStorage:
  │  Canvas reader + XOR decrypt (reader.js)       arie_p_<bookId>, arie_recent
  ▼
Netlify static (publish = public/)
  ├── index.html, css/styles.css, js/reader.js, js/smoke.js
  └── covers/paradoksat-na-bolkata.png            ← реалната корица
  │
  │  /api/* → /.netlify/functions/api/:splat      (netlify.toml redirect)
  ▼
Netlify Function: netlify/functions/api.js (Express + serverless-http)
  │  БЕЗ Supabase env vars ⇒ useLocalFallback = true (production днес)
  ├── data/catalog.json        ← SOURCE OF TRUTH (status='published' филтър)
  └── uploads/1_Paradoksat-na-bolkata.txt  ← текст, пагиниран на всяка заявка
       (двата файла влизат в function bundle през netlify.toml included_files)
```

- GitHub `Deyan2505/ARIE-BookReaderApp` (`main`) = source of truth за кода; Netlify
  auto-deploy от него. Production commit: `d07f172`.
- Supabase клон в api.js СЪЩЕСТВУВА, но е **неактивен** и **schema-остарял**
  (избира `id,title,size_bytes,uploaded_at,content`; няма subtitle/cover/series/status).
- `server.js` е локален wrapper на същото Express app + static (порт 3001/PORT env).
- Encryption: XOR + Base64; ключ = `<bookId>_ARIE_GOLDEN_SECRET_SALT_2026` (deterrence
  по дизайн, документирано в decision_log.md — не се променя в началните фази).

## 2. Осемте места за съхранение (карта)

| # | Хранилище | Съдържание | Роля |
|---|---|---|---|
| 1 | Локален диск (OneDrive папка) | пълният source + uploads + node_modules | работно копие |
| 2 | GitHub `main` | всичко без gitignored | source of truth за код + данни днес |
| 3 | Netlify static CDN | `public/` | frontend + корици |
| 4 | Netlify Function bundle | api.js + `data/**` + двата uploads файла | API + книжно съдържание днес |
| 5 | `uploads/` | 2 файла на книгата + 1 stray gitignored файл | книжен текст (dev + prod bundle) |
| 6 | `data/catalog.json` | метаданни на 1 книга | каталог source of truth днес |
| 7 | Supabase | **не се използва**; няма credentials никъде | целево production хранилище за V2 |
| 8 | Browser localStorage | `arie_p_<id>`, `arie_recent` | читателски прогрес (не се пипа) |

## 3. Опции за V2 source of truth (сравнение)

### Опция A — Git + catalog.json (статукво)
- ➕ Версионирано, просто, нула външни зависимости, доказано работещо, безплатно.
- ➖ „Качване" = commit + deploy → невъзможно от UI без Git/CI машинария; function bundle
  расте с всяка книга; included_files поддръжка; никаква auth история; книгите съдържимо
  в публично repo (ако repo-то е публично — риск за съдържанието).

### Опция B — Supabase Database + Storage + Auth (предложена)
- ➕ Реален авторски login (Supabase Auth) + server-side authorization + RLS; качване от UI
  без redeploy; книгата се появява веднага; draft/published/archived workflow; кориците в
  Storage/CDN; съдържанието извън Git; service-role key остава в Netlify env.
- ➖ Външна зависимост; изисква миграция + привеждане на api.js Supabase клона в паритет;
  free tier лимити (достатъчни за текущия обем); нужда от внимателна RLS конфигурация.

### Опция C — Хибрид (каталог в Git, файлове в Supabase)
- ➖ Две полу-истини вместо един source of truth; качването пак иска commit за каталога;
  най-лошото от двата свята. **Отхвърлена.**

### Препоръка
**Опция B**, на етапи: Phase 1 прави Supabase клона пълноценен и мигрира еднократно
съществуващата книга (id непроменено), Phase 2-3 добавят Auth + upload. Fallback режимът
(каталог + uploads) се запазва за локална разработка без мрежа — двата клона на api.js
връщат идентичен формат, което одитът доказа, че е критично.

## 4. Целева схема `books` (Supabase)

| Колона | Тип | Бележка |
|---|---|---|
| id | text PK | стабилен slug, НИКОГА не се променя (`paradoksat-na-bolkata`) |
| title, subtitle, author, description | text | author default 'Деян Арие' |
| series_id, series_title, series_order | text/text/int, nullable | самостоятелните книги: NULL (без изкуствена поредица) |
| category, language | text | 'novel'…, 'bg'… |
| status | text | 'draft' \| 'published' \| 'archived' |
| format | text | 'txt' (по-късно 'docx') |
| content | text | reader-ready plain text |
| original_path | text | път в Storage към оригиналния качен файл |
| cover_path | text | път в Storage bucket 'covers' (или public URL) |
| created_at, updated_at, published_at | timestamptz | |

Storage buckets: `book-originals` (private), `covers` (public read).
RLS: анонимен SELECT само при `status='published'` (и само безопасните колони през API);
всички write операции — само allowlisted admin (детайли в V2_SECURITY_AND_UPLOAD_RULES.md).

## 5. API целеви контракт (непроменен за читателя)

`GET /api/books`, `GET /api/books/:id/read`, `GET /api/books/:id/page/:num` запазват
точния днешен JSON формат (одитът съдържа еталонните отговори). Добавят се само
admin endpoints (Phase 3): `POST /api/admin/books` (draft), `POST /api/admin/books/:id/cover`,
`POST /api/admin/books/:id/publish`, всички с server-side token проверка.
