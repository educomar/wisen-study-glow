# Roadmap

## Past EMD academic scope — October 21
- [ ] Share subject/module selection across Past EMDs and exam-file uploads, retaining existing hierarchy and IDs.
- [ ] Validate subject/unit ownership and show published module exams under the correct student scope.
- [ ] Test Year 1/2/3 selections and authenticated upload/readback.

## Full French interface — October 13
- [x] Translate public, authentication and student pages, including toolbars, filters and dialogs.
- [x] Preserve EN / FR persistence and selected-language AI generation.
- [x] Verify French landing, sign-in, dashboard, Roadmap, Workspace, QBank simulator/history/mistakes, Kapsules and Library with authenticated data and English/French switching; no browser errors, build OK and 23 targeted tests pass.

## Academic naming cleanup — October 11
- [x] Review supplied naming map; standardize all 27 units, 159 lessons and 150 resource labels while preserving original file extensions and medical terminology.
- [x] Apply name-only database updates; unchanged integrity fingerprint confirms IDs, relationships, storage paths and other resource/curriculum fields remain intact. Update 95 AI question lesson labels and 28 Kapsule scope labels without changing content or counts.
- [x] Preserve old lesson links and saved personal scopes with exact aliases; ten tests pass, preview build OK, and authenticated Roadmap/course browsing and the existing 57-page PDF with selectable text work. Faculty QBank opens; no faculty questions exist to verify a practice session.

## Workspace studio redesign — October 11
- [x] Rebuild the edge-to-edge reader, floating course drawer, glass controls and selection toolbar.
- [x] Refine copilot/notebook with AI Elements, prompt chips and Kapsule preview while preserving existing study actions.
- [x] Verify an authenticated 57-page lecture, selection tools, note reload, saved Kapsule through Library, generated quiz and page-15 citation, zoom/fit-width, both themes and narrow-screen drawer; eleven tests pass and build OK. Changed workspace files pass lint; full-project lint still reports existing issues outside this scope and generated registry formatting.

## Parallel Study Workspace — October 11
- [x] Build the two-pane lecture reader and contextual Wisen AI on /workspace.
- [x] Add page/zoom controls, selected-passage actions and saved notes access using existing student persistence.
- [x] Verify a signed-in 57-page faculty lecture, selected-passage quiz, exact citation jump, saved notes after reload, Kapsules reopened through Library, zoom and small-screen layout; eleven existing study tests pass.

## Workspace entry — October 11
- [x] Replace Sheets in the top navigation with Workspace and add /workspace using the existing Study Sheets experience.
- [x] Verify Workspace navigation, page reload and existing /sheets links with no browser errors.

## Dedicated Library — October 8
- [x] Add the Library route, navigation, content tabs and live search.
- [x] Connect real saved Kapsule decks and Study Sheets to review, reopen, practice and export actions.
- [x] Verify thirteen data and study tests, authenticated deck/sheet actions, filtering, desktop/mobile layouts and no horizontal overflow or browser errors.

## Active Kapsules Hub — October 8
- [x] Replace the old configuration/preview layout with real deck counts, filters, manual creation and curriculum AI generation.
- [x] Add focused live review, keyboard controls, queue summary and preserved decks/history.
- [x] Verify eighteen tests, signed-in manual creation/keyboard review/summary/reload persistence, eight English cards generated from a faculty Physiology lecture, and mobile layout without overflow. Unreadable lecture files show a clear error.

## English-only Study Sheets — October 8
- [x] Translate sheet labels, suggestions, tags and course selection display without changing shared curriculum records.
- [x] Require English generated content from all source languages; twelve tests pass and signed-in generation from French notes produced six English sections and saved successfully with no browser errors.

## Structured Study Sheets — October 8
- [x] Rebuild composer and sectioned reader with profile-based topics and faculty material selection.
- [x] Add real section generation progress, skeletons, pretesting, sticky navigation and embedded Kapsules.
- [x] Connect saved sheets/cards, topic QBank, PDF/Word export and sharing; verify signed-in six-section generation, exact card saving, reload, sharing, exports, dark/phone layouts and ten passing tests.

## Academic Roadmap explorer — October 8
- [x] Add live curriculum search, semester filters, academic counts and expandable medical-icon subject rows.
- [x] Connect lesson materials and scoped question practice; exclude all personal progress indicators.
- [x] Test semester/search rules, signed-in lesson actions and both themes without overflow.

## Study page scale and branding — October 8
- [x] Expand study containers, cards, typography and controls while reducing excess margins.
- [x] Replace the text brand with the supplied theme-aware logo and add subtle flowing background motion.
- [x] Verify layouts at 390, 854, 1280 and 1920px; confirm logo loading, dark mode, live motion, reduced-motion behavior and no overflow or browser errors.

## Complete reference platform — October 8
- [x] Remove the old /home dashboard and redirect existing links to the new dashboard.
- [x] Build reference-style Dashboard, Roadmap, Sheets, Kapsules and QBank pages with shared navigation and existing Wisen data.
- [x] Add a live animated medical backdrop; verify five pages, authenticated sheet generation and saving after reload, mobile navigation and dark mode.

## /app reference rebuild — October 8
- [x] Replace the /app entry screen and navigation with the StudyBuddy dashboard composition, adapted to Wisen.
- [x] Preserve all study destinations, saved data and account controls; verify signed-in navigation, profile dialog, themes, background loading and desktop/mobile page health.

- [x] Replace the circular faculty badge with a prominent responsive rectangular photo card.
- [x] Update all four evidence cards with the supplied exact copy.
- [x] Verify light/dark desktop and mobile layouts and preview health.

## /app connected study workflow
- [x] Reorder sidebar, persistent state, connected loop across all tools
- [x] Do NOT add new sample questions (user request) — keep original 10 only

## Wisen AI product updates
- [x] QBank split: Wisen AI generated (SCQ/MCQ, subject/unit/lesson/file, difficulty) vs Previous-year EMDs
- [x] Wisen AI on Gemini Flash, branded Wisen only; LaTeX + mhchem rendering; file attach in chat
- [x] Remove control beside My courses; Biophysics S1/S2 French/English labels
- [x] Flashcards by subject / unit / file, saved to account
- [x] AI EMD exam from course files + past EMD style

## Personal dashboard and study environment
- [x] Implement compact medical-green direction based on the supplied Viomin references.
- [x] Build /home with real personal metrics, saved topics, manual weekly planner, summaries and focus session.
- [x] Organize /app into Study Room, Practice, Kapsules and Progress with dashboard deep links.
- [x] Add mistakes retry and conversion, Kapsules decks and review history, and EMD navigation.
- [x] Replace visible Flashcards terminology throughout the platform with Kapsules.
- [x] Persist new personal data with user ownership; verify signed-in task completion, reload, cross-browser Kapsule history and rejection of foreign-owned tasks.

## Student interface redesign — October 7
- [x] Present three rendered directions; user selected the balanced layout with StudyBuddy colors, fonts and background.
- [x] Unify Home/App navigation and rebuild the student interface using the chosen direction.
- [x] Remove Custom EMD and Parallel Workspace, preserving necessary course-file access and existing student data.
- [x] Keep each section focused; keep weak-area and lesson-performance information in Progress, and separate Kapsule creation from daily review.
- [x] Verify authenticated Home/App navigation, sidebar collapse/restore, all student views, a real 57-page course PDF, readable 16px sidebar labels, dark theme, no desktop overflow and clean runtime/build signals.
