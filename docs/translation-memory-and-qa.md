# Translation Memory and QA

This document describes the translation memory and QA subsystems added to the editor.

## Purpose

The feature adds two browser-local layers on top of the existing editing flow:

- translation memory for reusing approved translations
- QA checks for catching broken or inconsistent translations before export

Both systems are client-side. Nothing is stored in Supabase.

## Translation Memory

### Scope

Translation memory is scoped by:

- `projectName`
- `targetLanguage`

The project name is derived from the loaded file header first and falls back to the filename. It is
stored in `editor-store` and can be edited in Settings.

### Storage model

Source files:

- `src/lib/translation-memory/types.ts`
- `src/lib/translation-memory/project.ts`
- `src/lib/translation-memory/matcher.ts`
- `src/lib/translation-memory/formats/json.ts`
- `src/lib/translation-memory/formats/tmx.ts`
- `src/stores/translation-memory-store.ts`

Main concepts:

- `TranslationMemoryScope`: identifies one project/language bucket
- `TranslationMemoryEntry`: one approved source-to-target mapping
- `TranslationMemorySuggestion`: an exact or fuzzy match returned to the UI

Entries are deduplicated by:

- context
- singular source text
- plural source text

### Write rules

Only approved entries are written into translation memory.

Approved means:

- the entry is translated
- the entry is not marked `fuzzy`

This prevents low-trust drafts from becoming suggestions.

### Matching

`findTranslationMemorySuggestions()` returns:

1. exact matches first
2. fuzzy matches second

Fuzzy matches use normalized source text and a deterministic Dice-coefficient-style score. The UI
shows the best few matches and allows one-click apply into the current row.

### Import and export

Supported formats:

- JSON: app-native, lossless for current fields
- TMX: interoperability format for external CAT tools

Import merges into the active project scope. Clear actions only remove the current project scope.

## QA

### Source files

- `src/lib/qa/types.ts`
- `src/lib/qa/analyzer.ts`
- `src/stores/editor-store.ts`

### Report model

QA is stored per entry as `QAEntryReport`.

Each report contains:

- `issues`
- `errorCount`
- `warningCount`
- `analyzedAt`

Global export/UI counts are derived with `summarizeQaReports()`.

### Rules

Current rules:

- placeholder parity
- HTML tag parity
- ICU variable parity
- glossary conflict
- repeated-source consistency
- whitespace drift
- punctuation drift

Severity is either:

- `error`
- `warning`

### Repeated-source consistency

This rule runs as a second pass over the file.

If multiple approved entries share the same source text and context but have different target text,
each conflicting entry gets a warning.

## App Flow

Main orchestration lives in `src/pages/Index.tsx`.

Flow:

1. Load file into `editor-store`.
2. Derive `projectName`.
3. If a glossary is loaded, compute glossary analysis.
4. Compute QA reports from current entries plus glossary analysis.
5. Upsert approved entries into translation memory for the active scope.
6. On export, open a QA summary modal if issues remain.

## UI Surfaces

### Settings

`src/components/SettingsModal.tsx`

Provides:

- editable project name
- translation memory entry count
- JSON export
- TMX export
- JSON/TMX import
- clear current project memory

### Table and inspector

`src/components/editor/EditorTable.tsx`

Provides:

- QA badges in the signals column
- QA details in the inspector
- translation memory suggestions in the inspector
- one-click apply for suggestions

### Export warning

`src/pages/Index.tsx`

Export is not blocked. Instead:

- a QA summary modal is shown
- the user can review issues
- the user can still export anyway

## Contributor Notes

- If you change user-facing strings in these flows, run `bun run i18n:extract`.
- If you move existing `t()` / `msgid()` calls in these files, run `bun run i18n:extract` again so
  PO/POT source references stay in sync with CI.
- If you add a new QA rule, update both `src/lib/qa/types.ts` and `src/lib/qa/analyzer.ts`.
- If you change TM import/export shape, update both JSON and TMX handlers and their tests.
