/**
 * Context excerpt resolution for LLM translation providers.
 *
 * Re-exports the Gemini context resolver — the logic is provider-agnostic.
 */

export { resolveGeminiContextExcerpts as resolveLlmContextExcerpts } from '@/lib/gemini/context';
