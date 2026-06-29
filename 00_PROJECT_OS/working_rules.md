# Working Rules

> These rules govern every implementation step in this project.
> They are not suggestions. They are constraints.

---

## Before Every Implementation Step

1. **Read all files in `00_PROJECT_OS/` before writing any code.**
   - `book_reader_master_plan.md` — confirm the task is in scope and in the correct phase.
   - `current_status.md` — confirm what phase is active and what was last completed.
   - `feature_tracker.md` — confirm the feature is planned, not deferred or rejected.
   - `decision_log.md` — confirm no prior decision contradicts the planned change.
   - `working_rules.md` — this file.

2. **Report planned file changes before touching them.**
   Before writing code, state:
   - Which files will be changed.
   - What specifically will change in each file.
   - Any risk or side effect.
   Wait for author confirmation if the scope is larger than a single isolated fix.

3. **Confirm the active phase allows the work.**
   - Phases are sequential. Do not implement Phase 2 features while Phase 1 is active.
   - If a request sounds like a later phase, note the conflict and ask before proceeding.

---

## During Implementation

4. **Make small, safe, reversible steps.**
   - One logical change per step. Not five things at once.
   - If a step requires touching more than 3 files, it is probably too large — split it or ask.

5. **Do not rewrite the whole app.**
   - Edit existing files. Do not replace them with a full rewrite unless explicitly approved.
   - A full-file rewrite requires the author to say: *"Rewrite [file] from scratch."*

6. **Do not touch these without explicit per-task approval:**
   - `public/js/smoke.js` — WebGL smoke background. Do not touch.
   - The canvas text rendering logic in `reader.js` — Do not change how text is drawn.
   - The `encryptText()` / `decryptText()` XOR functions — Do not change.
   - The `ENCRYPTION_SALT` and `getBookKey()` in `api.js` — Do not change.

7. **Do not add features outside the current phase.**
   - If a refactor or improvement looks useful but is not in the current phase, log it in `feature_tracker.md` as `⬜ Planned` and leave it for the right phase.
   - Do not gold-plate. Minimum code that satisfies the phase goal.

8. **Do not add new dependencies without approval.**
   - Check `package.json`. If the task can be done with what is already installed, use that.
   - Adding a new `npm` package requires stating: what it is, why it is needed, and what the alternative without it would be.

---

## Conflict Resolution

9. **If a request conflicts with the master plan, stop and report the conflict.**
   Do not silently implement something that contradicts an approved decision.
   Format: *"This request conflicts with [decision from decision_log.md]. The plan says [X]. Do you want to change the plan or proceed within constraints?"*

10. **If a request is in a phase that has not been approved, stop and ask.**
    Format: *"This feature belongs to Phase [N]. Phase [N] has not been approved yet. Do you want to approve Phase [N] now or keep it deferred?"*

---

## After Every Implementation Step

11. **Update `current_status.md`.**
    - Date of completion.
    - What was done (bullet list).
    - Files changed.
    - Any known issues or remaining tech debt.

12. **Update `feature_tracker.md`.**
    - Mark completed features as `✅ Done`.
    - Mark any newly discovered planned items as `⬜ Planned`.
    - If something was rejected or deferred during the step, update its status.

13. **Update `decision_log.md` for any new architectural or product decision.**
    Even small decisions count if they affect future phases. Undocumented decisions become surprises.

14. **Report the result.**
    After each step, provide:
    - Files changed (with specific sections changed).
    - How to test what was built.
    - What to expect when tested.
    - Any risks or edge cases to watch.

---

## Quality Gates

15. **Run syntax checks before finishing any JS change.**
    `node --check public/js/reader.js`
    `node --check netlify/functions/api.js`

16. **Verify in the preview browser before reporting a visual change as done.**
    Use `preview_screenshot` and/or `preview_console_logs` to confirm no regressions.
    Check both desktop and mobile viewports for layout changes.

17. **Never mark a phase as complete without the author confirming it looks correct.**
    A phase is done when the author says it is done, not when the code is committed.

---

## What "Done" Means

A feature is `✅ Done` when:
- The code change is in place.
- `node --check` passes (for JS files).
- The preview shows the correct result with no console errors.
- The author has confirmed visually or verbally.

A phase is complete when:
- All features in that phase are `✅ Done` in `feature_tracker.md`.
- `current_status.md` is updated with the phase completion date.
- The author has said *"Phase [N] is done, start Phase [N+1]"* or equivalent.

---

## Tone and Communication

- Do not start implementing without confirming the plan.
- Do not summarize what you are "about to do" at length — state it briefly and then do it.
- Do not ask unnecessary questions. If the answer is in `00_PROJECT_OS/`, read it.
- If genuinely unsure about scope or risk: ask one clear question, not five.
