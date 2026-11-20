---
name: provision-psu-models
description: Provision OpenCode CLI worker runs on psu-dot-blue models matched by task capability and credit multiplier. Use when delegating coding, architecture, debugging, code review, research, or parallel tickets to OpenCode runners, or when choosing a psu-dot-blue model tier.
---

# Provisioning `psu-dot-blue` Models via OpenCode

Provision background or parallel worker runs through the `opencode` CLI against the university `psu-dot-blue` provider (`https://ai.psu.blue/v1`).

## Key Rotation & Quota Invariants (5 Keys, Reset 00:01 GMT+7)

`psu-dot-blue` rotates across 5 API keys (`PSU_DOT_BLUE_KEYS`) via the `psu-key-rotate` OpenCode plugin, with daily quota resetting at **00:01 GMT+7 (Bangkok)**:

- **Keep `--standalone` off**: Always run against the shared OpenCode background service (default). The service holds the in-memory `avoid` map so keys marked exhausted (`429` daily credit) stay skipped until 00:01 GMT+7 instead of being re-probed from key `#0` on every spawn.
- **Model-specific `403` vs. key exhaustion**: The rotation plugin does not rotate on `403` errors mentioning `model not available/allowed/unsupported`. If a run fails with a model-specific `403`, switch to an alternate model family in the same tier.
- **All-key daily exhaustion fallback**: If all 5 keys hit daily credit exhaustion before 00:01 GMT+7, switch non-critical tasks to the zero-credit models (`psu-dot-blue/psu-qwen` or `psu-dot-blue/psu-gemma`) or check `curl http://127.0.0.1:8787/health` if the local key-rotate proxy is active.

## Capability-First Routing Matrix

Select the model by task complexity first, preferring frontier `1×`–`3×` models and reserving `Free` (`0×`) for quota-exhausted fallback or trivial text generation.

| Tier | Primary Models (`psu-dot-blue/<id>`) | Alternate / Fallback in Tier | Target Workloads |
| :--- | :--- | :--- | :--- |
| **Heavy (`×3`)** | `glm-5.3`<br>`qwen3.7-plus` | Cross-family switch (`glm-5.3` ↔ `qwen3.7-plus`) | Hard bug diagnosis, cross-package architecture, security/concurrency audits, complex spec design |
| **Mid-Tier (`×2`)** | `gpt-5.6-luna`<br>`glm-5` | `glm-5` ↔ `gpt-5.6-luna` | Multi-file feature implementation, end-to-end API + UI wiring, schema/contract migrations |
| **Frontier Fast (`×1`)** | `claude-haiku-5.5`<br>`gpt-6-luna`<br>`deepseek-v4.1-flash` | `qwen3.8-27b`, `qwen3.6-plus`, `deepseek-chat`, `deepseek-v4-flash-0731`, `gpt-4o-mini`, `qwen3.6-27b`, `qwen3.6-flash` | Focused single-module coding, TDD unit tests, standards/spec code review, codebase exploration, Thai/English docs |
| **Zero-Credit (`Free`)** | `psu-qwen`<br>`psu-gemma` | `psu-qwen` ↔ `psu-gemma` | Fallback when all 5 keys exhaust daily credit before 00:01 GMT+7; simple commit messages or formatting |

> **Dynamic discovery**: If a model ID is rejected as unknown, run `opencode models` to verify the live `psu-dot-blue/*` catalog.

## Provisioning Procedure

### 1. Choose Model & Isolation Mode
- Match the task to the **Capability-First Routing Matrix** above.
- Pick execution isolation:
  - **In-place** (no `--worktree`): Read-only exploration, code review, research, or a single sequential edit when no other worker is modifying the working tree.
  - **Isolated worktree** (`--worktree <task-slug>`): Concurrent/parallel file-modifying runs, or risky refactors that must pass verification before merging.
- **Completion criterion**: Every dispatched run has an explicit `psu-dot-blue/<model>` and an isolation mode guaranteed not to collide on dirty files.

### 2. Compose a Pointer-Based Prompt
- Communicate through **context pointers** rather than inlining file contents:
  - Exact file paths and line ranges to read or edit.
  - Contract or ticket references (`packages/shared/src/contracts.ts`, issue ID, or spec section).
  - Exact verification command the worker must pass before finishing (e.g., `npm run build`, `go vet ./...`).
- Attach a reference file with `-f <path>` only when a local scratch/spec file is outside normal repo discovery.
- **Completion criterion**: The prompt names the target files, constraints, and the exact verification command that defines done.

### 3. Dispatch the OpenCode Run
Run via `opencode run` against the shared background service (never `--standalone` unless debugging the server itself):

- **Single / Read-only / Sequential Run**:
  ```powershell
  opencode run -m psu-dot-blue/<model> --auto --archived --title "<short-task-title>" "<pointer-based prompt>"
  ```
- **Parallel Modifying Run (Isolated Git Worktree)**:
  ```powershell
  opencode run -m psu-dot-blue/<model> --worktree <task-slug> --auto --archived --title "<short-task-title>" "<pointer-based prompt>"
  ```
- **Multi-turn Continuation** (when a worker needs a follow-up instruction in the same context):
  Pass `--session <session-id>` (or `--format json` on initial run to capture structured output/session metadata).
- **Completion criterion**: The `opencode run` process exits with code `0` and produces its final report or diff.

### 4. Verify & Integrate
- Inspect `git status -s` and `git diff` (in the main tree or the worker's worktree).
- Run the deterministic verification gates (`npm run build`, `go vet ./...`, or target test suite).
- For worktree runs: merge the verified branch into the integration branch and clean up the worktree (`git worktree remove <path>`).
- If the run failed with:
  - **`403` model not allowed/available**: Re-dispatch once with an alternate model family in the same capability tier.
  - **`429` daily credit exhausted on all 5 keys**: Report that the 5 rotated keys have hit the daily limit (resets at 00:01 GMT+7) and offer to continue on `psu-dot-blue/psu-qwen` (`Free`) or pause until reset.
- **Completion criterion**: All automated build/test checks pass on the integrated changes and temporary worktrees are cleaned up.
