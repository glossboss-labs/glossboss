/**
 * Centralized localStorage / sessionStorage key constants.
 *
 * Every storage key used by the application should be defined here to
 * avoid magic strings scattered across the codebase and to make auditing
 * storage usage straightforward.
 */

// ── Provider settings (session/localStorage with persist toggle) ─────

export const DEEPL_SETTINGS_KEY = 'glossboss-deepl-settings';
export const DEEPL_PERSIST_KEY = 'glossboss-deepl-persist';

export const AZURE_SETTINGS_KEY = 'glossboss-azure-settings';
export const AZURE_PERSIST_KEY = 'glossboss-azure-persist';

export const GEMINI_SETTINGS_KEY = 'glossboss-gemini-settings';
export const GEMINI_PERSIST_KEY = 'glossboss-gemini-persist';

export const LLM_SETTINGS_KEY = 'glossboss-llm-settings';
export const LLM_PERSIST_KEY = 'glossboss-llm-persist';

export const GITHUB_SETTINGS_KEY = 'glossboss-github-settings';
export const GITHUB_PERSIST_KEY = 'glossboss-github-persist';

export const GITLAB_SETTINGS_KEY = 'glossboss-gitlab-settings';
export const GITLAB_PERSIST_KEY = 'glossboss-gitlab-persist';

export const TTS_SETTINGS_KEY = 'glossboss-tts-settings';
export const TTS_PERSIST_KEY = 'glossboss-tts-persist';

// ── OAuth tokens ─────────────────────────────────────────────────────

export const GITHUB_OAUTH_TOKEN_KEY = 'glossboss-github-oauth-token';
export const GITLAB_OAUTH_TOKEN_KEY = 'glossboss-gitlab-oauth-token';

// ── Translation ──────────────────────────────────────────────────────

export const TRANSLATION_PROVIDER_SETTINGS_KEY = 'glossboss-translation-provider-settings';
export const TRANSLATION_USAGE_KEY = 'glossboss-translation-usage';

// ── App preferences ──────────────────────────────────────────────────

export const APP_LANGUAGE_KEY = 'glossboss-app-language';
export const CONTAINER_WIDTH_KEY = 'glossboss-container-width';
export const SPEECH_ENABLED_KEY = 'glossboss-speech-enabled';
export const TRANSLATE_ENABLED_KEY = 'glossboss-translate-enabled';
export const WORKSPACE_MODE_KEY = 'glossboss-editor-workspace-mode';

// ── Cloud settings sync ─────────────────────────────────────────────

export const CLOUD_SETTINGS_ENABLED_KEY = 'glossboss-cloud-settings-enabled';
export const CLOUD_CREDENTIAL_SYNC_KEY = 'glossboss-cloud-credential-sync';

// ── Editor UI persistence ────────────────────────────────────────────

export const NAV_SKIP_TRANSLATED_KEY = 'glossboss-nav-skip-translated';
export const INSPECTOR_WIDTH_KEY = 'glossboss-inspector-width';
export const INSPECTOR_OPEN_KEY = 'glossboss-inspector-open';
export const COLUMN_WIDTHS_KEY = 'po-editor-column-widths';
export const ROWS_PER_PAGE_KEY = 'po-editor-rows-per-page';
export const EDITOR_STATE_KEY = 'po-editor-state';
export const DRAFT_KEY_PREFIX = 'po-editor-draft:';
export const DRAFT_INDEX_KEY = 'po-editor-draft-index';

// ── Glossary ─────────────────────────────────────────────────────────

export const GLOSSARY_SELECTED_LOCALE_KEY = 'glossboss-selected-glossary-locale';
export const GLOSSARY_ENFORCEMENT_KEY = 'glossboss-glossary-enforcement';
export const DEEPL_GLOSSARY_MAPPING_KEY = 'glossboss-deepl-glossary-mapping';
export const WP_GLOSSARY_CACHE_PREFIX = 'glossboss-wp-glossary-';

// ── Tours & onboarding ──────────────────────────────────────────────

export const EDITOR_TOUR_KEY = 'glossboss-editor-tour-completed';
export const SETTINGS_TOUR_KEY = 'glossboss-settings-tour-completed';
export const API_KEY_SETUP_PROMPTED_KEY = 'glossboss-api-key-setup-prompted';
export const DASHBOARD_WELCOME_DISMISSED_KEY = 'glossboss-dashboard-welcome-dismissed';

// ── Development ──────────────────────────────────────────────────────

export const DEV_BRANCH_CHIP_KEY = 'glossboss-dev-branch-chip';

// ── Auth ─────────────────────────────────────────────────────────────

export const OAUTH_RETURN_PATH_KEY = 'glossboss-oauth-return-path';
export const PLAN_PARAMS_KEY = 'glossboss-plan-params';

// ── Zustand stores ───────────────────────────────────────────────────

export const REPO_SYNC_STORE_KEY = 'glossboss-repo-sync';
export const TRANSLATION_MEMORY_STORE_KEY = 'glossboss-translation-memory';
export const SOURCE_STORE_KEY = 'glossboss-source-store';

// ── Sidebar ──────────────────────────────────────────────────────────

export const SIDEBAR_COLLAPSED_KEY = 'gb-sidebar-collapsed';
export const SIDEBAR_WIDTH_KEY = 'gb-sidebar-width';
export const RECENT_PROJECTS_KEY = 'glossboss-recent-projects';
