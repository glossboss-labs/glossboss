# Continue GlossBoss SaaS Implementation

You are resuming work on the GlossBoss SaaS platform. Follow this procedure exactly.

## Step 1: Gather current state

Run these commands to understand where things stand:

1. Fetch all open issues from the project board:
```
gh project item-list 1 --owner glossboss-labs --format json
```

2. Fetch the full body of each open issue to see checked/unchecked tasks:
```
gh issue list --repo glossboss-labs/glossboss --state open --json number,title,body,labels --limit 50
```

3. Check git log for recent work:
```
git log --oneline -20
```

4. Check if there are uncommitted changes:
```
git status
```

5. Read the implementation plan in CLAUDE.md for overall context.

## Step 2: Analyze and report

Based on the gathered data, produce a concise status report:

- Which phases/tasks are **Done** (all checkboxes checked, issue closed)
- Which phase/task is **In Progress** (some checkboxes checked, issue open)
- Which phases/tasks are **Blocked** or need decisions
- What the **next actionable task** is

Present this as a table and ask: "Should I continue with [next task], or do you want to work on something else?"

## Step 3: Execute

When given the go-ahead:

1. **Before starting a task**: Update the GitHub issue to mark it as in-progress on the project board:
```
gh project item-edit --project-id PVT_kwDOD_piyc4BRsgd --id <ITEM_ID> --field-id <STATUS_FIELD_ID> --single-select-option-id <IN_PROGRESS_ID>
```

2. **While working**: Follow CLAUDE.md instructions strictly — run the full CI surface (`bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run build`, `bun run test:coverage`) before considering any task complete. Run `bun run i18n:extract` if any translatable strings changed.

3. **After completing a sub-task**: Update the GitHub issue body to check off completed items:
```
gh issue edit <NUMBER> --repo glossboss-labs/glossboss --body "<updated body with checked boxes>"
```

4. **After completing an entire phase issue**: Close the issue and move it to Done on the project board.

5. **If the plan needs to change**: Update the issue body with the revised plan, add a comment explaining what changed and why, and inform the user.

## Step 4: Push and sync

After completing work:

1. Commit with conventional commit messages
2. Push to the private repo: `git push glossboss-labs HEAD:main`
3. Verify CI passes: `gh run list --repo glossboss-labs/glossboss --limit 1`

## Key references

- **Private repo**: `glossboss-labs/glossboss`
- **Project board**: Project #1 in `glossboss-labs` org (ID: `PVT_kwDOD_piyc4BRsgd`)
- **Staging Supabase**: `aejlzcovdxwwlkreohak` at `https://aejlzcovdxwwlkreohak.supabase.co`
- **Dev site**: `https://glossboss-dev.pages.dev` (protected by Cloudflare Access)
- **Dev workspace**: `~/Codebase/glossboss-cloud/`
- **Supabase access token**: stored in GitHub secret `SUPABASE_ACCESS_TOKEN`
- **Edge function deploy**: `SUPABASE_ACCESS_TOKEN=<token> bunx supabase functions deploy --project-ref aejlzcovdxwwlkreohak`

## Phase dependency order

```
Phase -1 (Done) -> Phase 0 (Foundation) -> Phase 1 (Auth) -> Phase 2 (Cloud Projects)
                                                                  |-> Phase 3 (Teams) -> Phase 4 (Realtime)
                                                                  |                   -> Phase 5 (Public)
                                                                  |-> Phase 6 (Notifications)
                                                                  |-> Phase 7 (Monetization)
```

Always work on the lowest-numbered unfinished phase that has its dependencies met.
