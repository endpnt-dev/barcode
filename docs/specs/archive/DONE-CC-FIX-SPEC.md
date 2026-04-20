# CC TASK: Recover from stuck npm install

**Agent:** Direct action acceptable (infrastructure recovery, no code changes)

---

## Problem

You've been running multiple concurrent `npm install` processes for 40+ minutes. They're racing each other on the same `node_modules/` directory. Dependencies appear installed (next/, react/, bwip-js/, etc. all present) BUT `node_modules/.bin/` is empty — meaning npm never finished the "link binaries" step.

That's why `next: not found` — the `next` binary symlink was never created.

## Honest root cause

This wasn't a library problem or a WSL permissions problem. It was:
- Multiple `npm install` invocations running simultaneously
- Each one interrupting the other's `.bin/` linking phase
- Resulting in a corrupt half-installed state

Starting fresh in a clean sequence will fix it.

---

## Fix steps (run IN ORDER, wait for each)

### 1. Kill ALL npm and node processes

```bash
# Kill anything npm/node related that's still running
pkill -9 -f "npm" 2>/dev/null || true
pkill -9 -f "next" 2>/dev/null || true
pkill -9 -f "node" 2>/dev/null || true

# Wait a moment
sleep 3

# Verify nothing is running
ps aux | grep -E "npm|next|node" | grep -v grep
# Should return NOTHING. If it returns anything, wait and try again.
```

### 2. Nuke the corrupt node_modules

```bash
# The half-installed state needs to go entirely
rm -rf node_modules
rm -f package-lock.json

# Verify
ls -la | grep node_modules  # Should show nothing
```

### 3. Clean npm cache (defensive)

```bash
npm cache clean --force
```

### 4. ONE clean npm install — let it run to completion

```bash
# Foreground, not background. Do NOT add flags. Do NOT run other npm commands
# concurrently. Just let it work.
npm install
```

This will take 3-5 minutes. **Wait for the prompt to return.** Do not interrupt. Do not start other bash commands in parallel.

When it completes, the last output should look like:
```
added N packages, and audited N+1 packages in Xs
```

### 5. Verify the install actually completed

```bash
# Critical check — the next binary must exist as a symlink
ls -la node_modules/.bin/next

# Should output something like:
# lrwxrwxrwx ... node_modules/.bin/next -> ../next/dist/bin/next
```

If `.bin/next` is missing, the install is still broken. Do NOT proceed — escalate.

### 6. Now run the build

```bash
npm run build
```

This should actually work this time. If it produces TypeScript errors, THOSE are real errors to fix — you've just cleared the infrastructure blocker.

---

## After build passes

Per CLAUDE.md workflow:

1. Launch `review-qa-agent` on the full diff of files CC created (lib/*, app/api/v1/*, etc.)
2. Address QA findings
3. Commit and push
4. Watch Vercel deploy
5. Smoke test against https://barcode.endpnt.dev

## Do NOT

- Do NOT run `npm install` multiple times in parallel
- Do NOT run it in background mode again — foreground only, wait for completion
- Do NOT try creative flags (`--no-optional`, `--legacy-peer-deps`, `--no-package-lock`) unless a specific error requires them
- Do NOT try `sudo` — you don't need root; the files are in your WSL user directory

## Status report required after this

When you're past this blocker, report:

```
Infrastructure recovery:
- All npm/node processes killed: yes
- node_modules removed: yes
- Single npm install run: exit 0 in X minutes
- .bin/next symlink verified: yes
- npm run build: exit 0 / exit N with errors: [list]

If build succeeded, continue with normal workflow (QA agent → commit → push).
If build has TypeScript errors, report each one honestly — do NOT push.
```

---

## ✅ Completion Record

- **Completed:** 2026-04-16
- **Final commit:** [commit hash from npm recovery completion]
- **Vercel deployment:** green
- **Agents invoked:** debug-agent, review-qa-agent
- **Smoke tests:** [N of N] passing
- **Notes:** Infrastructure-only recovery. package-lock.json regenerated successfully. Routes subsequently built per original CC-SPEC.md. Spec sat in repo root until 2026-04-20 housekeeping sweep.
