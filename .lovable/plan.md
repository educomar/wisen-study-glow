# Dedicated Library

## Build
- Add `/library` inside the existing Wisen study shell and point the shared Library navigation item to it.
- Build the requested Library header, All/Decks/Sheets tabs, and instant search by title, module, subject, or saved content.
- Derive Kapsule decks from the student's real manual and AI cards, showing card and due counts with a direct review action.
- Parse the student's real saved Study Sheets into cards with topic, subject, saved date, and key-takeaway preview.
- Connect sheet actions to reopen the saved sheet, start scoped QBank practice, and export the saved content.
- Add separate and combined empty states with direct creation links.

## Technical details
- Keep account ownership and persistence unchanged by reading the existing student store and AI-card store.
- Pass selected deck/sheet intent through typed route search parameters so existing tools open the requested content rather than duplicating study logic.
- Add route-specific metadata and responsive warm-paper/dark-theme styles matching the current student pages.
- Add small tests for saved-sheet parsing and deck grouping, then verify the signed-in Library flow and responsive layout.
