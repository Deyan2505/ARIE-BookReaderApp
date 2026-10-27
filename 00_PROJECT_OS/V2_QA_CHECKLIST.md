# V2 QA Checklist — ARIE BookReaderApp

> Създаден: 2026-07-19. Раздел A е ИЗПЪЛНЕН при одита (baseline). Раздели B-D се
> изпълняват при съответните фази — никоя фаза не е Done без своите редове тук.

---

## A. Baseline production QA — изпълнено 2026-07-19 ✅

| Проверка | Резултат |
|---|---|
| `/api/books` връща публикуваната книга с пълни метаданни | ✅ 200, 1 книга |
| `/read` + `/page/N` работят, XOR декрипцията е коректна (page 1 = `##COVER##`) | ✅ |
| Deployed frontend = GitHub main = локален код (MD5) | ✅ 4/4 файла идентични |
| Библиотеката рендерира картата с реалната корица; без console errors | ✅ screenshot |
| Отваряне на книга → cover → стр. 2 с декриптиран кирилски текст + watermark | ✅ screenshot |
| Прогрес `arie_p_<id>` + „Последно отворени" работят в production | ✅ (1% · стр. 2 от 232) |
| Mobile 375×812: библиотека + карти коректни | ✅ screenshot |
| `/covers/*.png` 200 image/png | ✅ |
| SPA redirect `/read/*` → index.html | ✅ 200 |
| Несъществуваща книга → 404 с fallback съобщение (не 500) | ✅ |
| Netlify env: нула променливи (SUPABASE_*: missing) — без изтекли secrets | ✅ |
| Working tree чист след одита | ✅ |

## B. Регресионен пакет (пуска се след ВСЯКА фаза)

- [ ] Съществуващата книга се отваря; съдържанието на страниците е байт-идентично
- [ ] Прогресът остава закачен за стабилното book id; две книги пазят независим прогрес
- [ ] Hash routing, теми, шрифт, fullscreen, стрелки, progress-bar jump — работят
- [ ] Копиране/печат/DevTools deterrence + watermark — непроменени
- [ ] `node --check` на всеки променен JS; нула console errors desktop + mobile
- [ ] `node server.js` локално = production поведение на трите read endpoints

## C. Security QA (Phase 2-3, задължителни преди deploy на upload)

- [ ] Публичен посетител не вижда бутона „Качи книга"
- [ ] Неавтентикирана write заявка → 401/403 (тест с curl, не само през UI)
- [ ] Автентикиран НЕ-admin потребител не може да качва (allowlist enforced server-side)
- [ ] Admin може да качи валидна книга end-to-end
- [ ] Невалиден тип файл → отхвърлен; oversized файл → отхвърлен; дублиран slug → отхвърлен
- [ ] Провалено качване на корица НЕ създава публикувана непълна книга (остава draft)
- [ ] Draft не се вижда: нито в `/api/books`, нито с директен `/read` на draft id
- [ ] Публикувана книга се появява в библиотеката БЕЗ редакция на код
- [ ] Никакви secrets в client JS bundle (grep за service_role/JWT префикси), нито в Git
- [ ] RLS тест с anon key директно срещу Supabase: draft невидим, write отказан

## D. Deploy и rollback

- [ ] Deploy само от branch след одобрение; Netlify build успешен; function logs чисти
- [ ] След deploy: пълен раздел A срещу production URL
- [ ] Rollback документиран и изпробван: Netlify → Deploys → предишен ready deploy →
      "Publish deploy" (моментално връщане), плюс `git revert` в main
- [ ] При Supabase миграция: книгата е мигрирана със СЪЩОТО id; преди превключване
      env vars се задават чак след като schema паритетът е тестван локално срещу
      Supabase проекта (иначе латентният риск от одита раздел 7.1 се материализира)
