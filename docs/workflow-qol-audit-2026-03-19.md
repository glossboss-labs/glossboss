# GlossBoss Workflow QoL Audit

Date: 2026-03-19

## Summary

This revision is intentionally `observed-only`.

Every finding below was confirmed in the live product with Playwright during public and authenticated walkthroughs. Items that were previously code-backed but not reproduced in the browser have been removed from the findings ledger rather than carried forward as assumptions.

The clearest pattern is that GlossBoss already has solid workflow primitives, but the UI often explains too much and resolves too little in place. The two biggest issues are:

- provider setup and switching are still settings-driven instead of editor-driven
- key surfaces are overly text-heavy, which buries the primary action and makes the product feel busier than it needs to

## Method And Scope

Observed live on `https://glossboss.ink`:

- landing page
- login
- signup
- explore
- public project detail
- authenticated dashboard
- authenticated editor
- authenticated settings: account, billing, translation
- authenticated project settings: general, translation, members for a public project the current user is not a member of
- new project modal entry flow

Notes:

- The browser session used a real logged-in account provided during the walkthrough.
- No destructive actions were taken.
- No forms were submitted that would create or delete app data.

## Not Verified In This Session

These areas are intentionally excluded from the findings because they were not confirmed live:

- successful provider configuration and post-save behavior
- whether configuring a provider automatically changes the active default
- onboarding after fresh signup
- org-admin translation settings behavior
- shared credential execution behavior during actual translation
- manager/admin-only project editing flows

## Executive Shortlist

1. `O01` Add inline provider switching inside the editor.
2. `O02` Show provider source and scope where translation happens.
3. `O03` Stop sending users from the editor to a generic translation settings page with no task return.
4. `O04` Give disabled row-level and inspector translation actions a recovery path.
5. `O05` Reduce text clutter and improve hierarchy across dashboard and settings surfaces.
6. `O06` Make translation settings show the current active/default provider more explicitly.
7. `O07` Add meaningful public read-only project inspection before asking people to join.
8. `O08` Fix the Explore language-count inconsistency.
9. `O09` Explain disabled auth CTAs while captcha/security checks are loading.
10. `O10` Bring landing copy in line with the actual provider-switching workflow.

## Complete Findings Ledger

### O01 — No inline provider switching in the editor

- Workflow: editor, provider/setup
- Severity: High
- Impact: High
- Effort: Medium
- Confidence: High
- Evidence:
  - In the editor, the machine translation toolbar showed `DeepL` as a badge beside `Machine translation`.
  - No switcher or chooser was visible there.
  - The primary recovery action was `Set up API key`, which routed away from the editor.
- Why it matters: provider choice is part of active translation work, but the product still treats it as a separate settings task.
- Suggested change: make the provider badge in the editor clickable and open a lightweight chooser with any relevant lock/explanation states.

### O02 — The editor hides provider source and scope while project settings expose it elsewhere

- Workflow: editor, cloud project flow
- Severity: High
- Impact: High
- Effort: Medium
- Confidence: High
- Evidence:
  - In the editor, the user sees `DeepL` but not whether that comes from a personal, project, or org-level rule.
  - In project translation settings, the same language showed `Global default (DeepL)` and `Personal`, plus `Provider: Global default (DeepL)`.
- Why it matters: the system clearly has source/scope concepts, but they are hidden in the place where users actually translate.
- Suggested change: show the active provider together with its source inline in the editor, with a short explanation when the user cannot change it there.

### O03 — Editor setup CTAs send users to a generic settings detour with no return context

- Workflow: editor, provider/setup
- Severity: High
- Impact: High
- Effort: Medium
- Confidence: High
- Evidence:
  - In the editor, clicking `Set up API key` navigated to `/settings?tab=translation`.
  - The destination page was a broad translation settings screen, not a provider-specific setup step.
  - No visible “return to editor” action or “resume what you were doing” cue was present after arrival.
- Why it matters: users leave their task to satisfy one requirement, then have to manually recover their context.
- Suggested change: deep-link to the relevant provider card, preserve origin context, and offer a clear return-to-editor action after save/test success.

### O04 — Disabled row-level and inspector translate actions have no local recovery path

- Workflow: editor
- Severity: High
- Impact: High
- Effort: Small
- Confidence: High
- Evidence:
  - Each row showed a disabled `Translate with DeepL` action.
  - The string inspector also showed a disabled `Translate with DeepL` action.
  - Only the bulk translation toolbar surfaced the setup explanation and CTA.
- Why it matters: many users start at the string they are looking at, not at the batch toolbar above the table.
- Suggested change: make disabled row and inspector actions open a compact recovery popover with the current provider, the missing prerequisite, and the next step.

### O05 — Dashboard and settings surfaces are too text-heavy for their primary jobs

- Workflow: dashboard, settings, onboarding-adjacent
- Severity: High
- Impact: High
- Effort: Medium
- Confidence: High
- Evidence:
  - The empty dashboard stacked multiple explanatory paragraphs around `No projects yet` and `No organizations yet`.
  - Account settings used explanatory paragraphs under most sections, including `Change password`, `Connected accounts`, `Cloud sync`, `Export your data`, and `Delete account`.
  - Translation settings opened with several paragraphs, an info alert, a recommendation panel, and then the provider cards.
  - The new project modal felt materially clearer because it led with actions and short descriptions instead of long explanation blocks.
- Why it matters: the product often explains the model before helping the user act, which adds scanning cost and makes the UI feel cluttered.
- Suggested change: compress secondary copy, move low-priority explanation behind disclosure or helper text, and lead each section with the primary action or state summary.

### O06 — Translation settings do not make the current active/default provider obvious enough

- Workflow: settings, provider/setup
- Severity: Medium
- Impact: High
- Effort: Small
- Confidence: High
- Evidence:
  - The translation settings page started with local/cloud explanation, a machine-translation toggle, a privacy alert, a recommendations block, and then provider cards.
  - No top summary answered the question “what provider will the editor use right now?”
  - The page required scanning multiple sections before reaching provider controls.
- Why it matters: users need a quick state summary before they need a setup tutorial.
- Suggested change: add a compact top-level summary for active/default provider and treat the provider cards as the second step.

### O07 — Public project pages stop at project summary instead of letting visitors inspect real translation work

- Workflow: public/discovery
- Severity: High
- Impact: High
- Effort: Medium
- Confidence: High
- Evidence:
  - Public project detail showed language progress, counts, and a `Join as translator` CTA.
  - It did not expose a read-only string list or language drill-down for inspection.
- Why it matters: potential contributors can see that work exists, but not what the work actually looks like before committing.
- Suggested change: add a read-only language/string preview for public projects so visitors can inspect real content before joining.

### O08 — Explore shows an inconsistent language count

- Workflow: public/discovery
- Severity: Medium
- Impact: Medium
- Effort: Small to Medium
- Confidence: High
- Evidence:
  - On Explore, the project summary strip showed `1 projects`, `1,693 strings`, and `0 languages`.
  - Opening the corresponding public project showed `1 language`.
- Why it matters: public stats that disagree with each other erode trust quickly.
- Suggested change: fix the aggregation/data source behind Explore’s language count and add a regression check for this summary.

### O09 — Login and signup actions can appear disabled without explanation

- Workflow: auth
- Severity: Medium
- Impact: Medium
- Effort: Small
- Confidence: High
- Evidence:
  - During public auth walkthroughs, the primary CTA on login and signup appeared disabled on first load.
  - The UI did not explain that a security/captcha readiness step was still loading.
- Why it matters: a disabled primary action with no reason reads as broken.
- Suggested change: show a brief inline status message while the security check is initializing.

### O10 — Landing copy over-promises provider switching smoothness

- Workflow: landing, expectation-setting
- Severity: High
- Impact: Medium
- Effort: Small
- Confidence: High
- Evidence:
  - Landing/marketing copy promises provider switching “mid-session”.
  - In the live editor flow, provider change/setup still required leaving the editor for settings.
- Why it matters: this creates expectation debt exactly around one of the product’s most important workflows.
- Suggested change: either ship inline switching in the editor or narrow the copy until the workflow matches the claim.

### O11 — Signup is missing the same local-editor escape hatch that login has

- Workflow: auth, onboarding-adjacent
- Severity: Low
- Impact: Medium
- Effort: Small
- Confidence: High
- Evidence:
  - The login flow exposed a clear “continue without account” path.
  - The signup flow did not offer the same off-ramp.
- Why it matters: users who arrive via a free/local-editor promise should be able to back out of account creation cleanly.
- Suggested change: mirror the local-editor fallback on signup.

### O12 — Public project contribution CTA is still abstract

- Workflow: public/discovery
- Severity: Medium
- Impact: Medium
- Effort: Small
- Confidence: High
- Evidence:
  - Public project detail prominently showed `Join as translator`.
  - The page did not clearly explain what the user would be able to do next on that specific project without joining first.
- Why it matters: the CTA asks for commitment before showing enough task-level value.
- Suggested change: make the CTA more specific to the visible project and language work.

### O13 — Non-member project settings are accessible but do not clearly frame permissions

- Workflow: public project management
- Severity: Medium
- Impact: Medium
- Effort: Small
- Confidence: High
- Evidence:
  - While logged in as a non-member, project settings pages were accessible for the public project.
  - The pages showed read-only information such as `Project details`, `Global default (DeepL)`, and member lists.
  - The UI did not clearly foreground that the viewer was in a read-only/limited-permission mode.
- Why it matters: the surface looks like settings, but the permission model is not obvious enough from the page state.
- Suggested change: add a clear permission banner or read-only mode label when a non-member is viewing public project settings.

## Grouped Backlog By Workflow

### Editor Workflow

- `O01` Add inline provider switching in the editor.
- `O02` Surface provider source and scope in the editor.
- `O03` Preserve editor context when users need provider setup.
- `O04` Add local recovery affordances to disabled row and inspector actions.

### Provider / Setup Workflow

- `O03` Deep-link setup CTAs into the right provider flow.
- `O06` Add a compact active/default provider summary in translation settings.
- `O10` Align landing claims with the implemented provider workflow.

### Dashboard / Project Flow

- `O05` Reduce explanatory text density and improve action hierarchy.
- `O13` Make read-only permission state explicit in public project settings.

### Public / Discovery Flow

- `O07` Add read-only public string inspection.
- `O08` Fix Explore language-count inconsistency.
- `O12` Make contribution CTAs more concrete and project-specific.

### Auth / Onboarding-Adjacent Flow

- `O09` Explain disabled auth CTAs while security checks initialize.
- `O11` Add a local-editor escape hatch to signup.

## Implementation Sequencing

### Batch 1 — Fast wins with high user impact

- `O03` Deep-link `Set up API key` into the relevant provider setup state and preserve return context.
- `O04` Add inline recovery UI for disabled translate actions.
- `O06` Add an “Active provider” summary at the top of translation settings.
- `O08` Fix the Explore language-count inconsistency.
- `O09` Explain disabled auth CTAs.
- `O11` Add the local-editor fallback to signup.
- `O13` Add a clear read-only permission banner in public project settings.

### Batch 2 — Medium-scope workflow improvements

- `O01` Add inline provider switching in the editor.
- `O02` Surface provider source and scope in the editor.
- `O05` Reduce copy density and improve hierarchy on dashboard/settings surfaces.
- `O07` Add a public read-only language/string preview.
- `O12` Make public contribution CTAs more concrete.

### Batch 3 — Expectation and positioning cleanup

- `O10` Reconcile landing copy with the actual provider workflow.

## Recommended Acceptance Criteria

- A user can identify the active provider from the editor without leaving their work.
- A user can start provider setup from the editor and return directly to the same task afterward.
- Disabled translation actions always explain why they are disabled and what to do next.
- Translation settings answer “what is active right now?” before showing setup details.
- The dashboard and settings pages prioritize action and state over explanatory copy.
- Public visitors can inspect real translation content before joining.
- Explore and project detail surfaces report consistent public metrics.

## Notes

- This document replaces the earlier mixed live/code audit with a live-verified version only.
- Code-backed suspicions that were not reproduced in the UI were intentionally removed rather than softened into pseudo-facts.
