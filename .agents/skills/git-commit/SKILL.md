---
name: git-commit
description: Inspect git changes, audit untracked files/directories to update .gitignore, group changes into logical atomic units, and commit them in sensible smaller commits with conventional commit messages. Use when the user runs /git-commit or asks to commit changes.
---

# Git Commit Workflow

Use this skill to inspect changes in the git repository, audit and update `.gitignore` for untracked or unwanted files, and commit changes cleanly. If there are multiple unrelated changes or large diffs, break them down into smaller, logical, atomic commits with informative Conventional Commit messages.

---

## Workflow Steps

### Step 1: Inspect Repository State & Check Working Tree

1. Run `git status -s` and `git status -u` to see all staged, unstaged, and untracked changes.
2. If the working tree is clean:
   - Inform the user: *"Working tree is clean. No changes to commit."*
   - Stop and exit the workflow.

---

### Step 2: Audit Untracked Files & Update `.gitignore`

Before staging any code, systematically evaluate all untracked files and directories to ensure no secrets, generated artifacts, or temporary files are accidentally tracked.

1. **Scan for Candidates to Ignore**:
   - **Secrets & Credentials**: `.env*` files (except `.env.example`), private keys (`*.key`, `*.pem`, `privatekey`), certificates (`*.crt`, `*.csr`), WireGuard configs (`*.conf`), authentication tokens.
   - **Build & Compilation Artifacts**: `dist/`, `build/`, `out/`, `*.tsbuildinfo`, `dist-ssr/`, and compiled JS/declaration files mistakenly generated in source folders (`src/**/*.js`, `src/**/*.d.ts`, `*.map`).
   - **Dependencies & Caches**: `node_modules/`, `.pnpm-store/`, `.cache/`, `.vite/`, `.eslintcache`, `.turbo/`, `.npm/`.
   - **Runtime Logs & Diagnostics**: `logs/`, `*.log`, debug outputs (`npm-debug.log*`, `yarn-error.log*`), crash dumps, test coverage reports (`coverage/`, `*.lcov`, `*.test`, `coverage.out`).
   - **Database & Docker State**: Local database files (`*.sqlite`, `*.db`), volume mounts (`postgres_data/`, `wireguard_config/`).
   - **OS & IDE Metadata**: `.DS_Store`, `Thumbs.db`, `Desktop.ini`, `.idea/`, `.vscode/`, `*.swp`.

2. **Action if Candidates are Found**:
   - Add the necessary patterns/rules to `.gitignore` under the appropriate section comment.
   - If stray build artifacts were generated inside source folders (e.g. `packages/*/src/*.js` where `outDir` should be `dist/`), remove or clean them up so they do not pollute source control.
   - If `.gitignore` was modified:
     - Stage `.gitignore`: `git add .gitignore`
     - Commit `.gitignore` first as a distinct atomic commit:
       ```powershell
       git commit -m "chore(git): update .gitignore for <ignored patterns>"
       ```
     - Re-run `git status -s` to verify that the ignored files are no longer listed as untracked.

---

### Step 3: Analyze & Group Remaining Changes Logically

Run `git diff --stat` (or `git diff` for specific files) to assess the scope of each change.

Group modified and untracked files into separate logical units based on the following criteria:

- **By Scope / Monorepo Package**:
  - Root configuration & build tooling (`package.json`, `tsconfig*.json`, `docker-compose.yml`, `scripts/`)
  - Documentation (`README.md`, `QUICKSTART.md`, translations `*.th.md`, documentation assets)
  - Specific packages or workspaces (e.g. `packages/<name>/`, `Sobree/*`, `Rain/*`)
- **By Purpose / Concern**:
  - Independent bug fixes should be isolated from feature additions.
  - Refactoring or formatting changes should be separate from behavioral or functional changes.
  - Test additions or updates should ideally accompany the feature/fix or be committed separately if standalone.
- **Sizing Rule**:
  - **1-3 closely related files**: If all changes serve a single unified purpose, commit them together in one commit.
  - **Multiple unrelated files or distinct modules**: **Never** create a single monolithic commit (e.g. avoid `git add .` + "update project"). Split them into discrete, atomic commits.

---

### Step 4: Stage and Commit Incrementally

For each logical group:

1. **Stage only the relevant files** for this specific group:
   ```powershell
   git add path/to/file1 path/to/file2
   ```
   *(Do NOT run `git add .` or `git add -A` when multiple logical groups exist.)*

2. **Compose a Conventional Commit message**:
   Format:
   ```text
   <type>(<scope>): <imperative summary>

   [optional body explaining 'why' if change is complex or non-trivial]
   ```
   Types:
   - `feat`: A new feature or capability
   - `fix`: A bug fix
   - `docs`: Documentation changes only
   - `chore`: Maintenance, dependencies, or configuration tasks
   - `build`: Build system, docker, or dependency management
   - `refactor`: Code change that neither fixes a bug nor adds a feature
   - `test`: Adding or updating tests
   - `style`: Formatting, semicolons, whitespace (no code change)
   - `ci`: CI/CD configuration files and scripts

3. **Execute the commit**:
   ```powershell
   git commit -m "<type>(<scope>): <summary>"
   ```
   *(If a multi-line message or body is needed, pass multiple `-m` flags or format accordingly.)*

4. **Verify after each commit**:
   - Run `git status -s` to verify staged changes were committed and review what remains.

5. Repeat until all intended changes are committed.

---

### Step 5: Verification & Summary

1. Verify remaining status:
   ```powershell
   git status
   ```
   Ensure no intended changes were left behind.
2. Review the newly created commits:
   ```powershell
   git log -n <number_of_new_commits> --oneline
   ```
3. Report a clear summary to the user:
   - List each commit hash and its message.
   - List the files included in each commit.
   - Note: Do **not** push to remote unless explicitly requested by the user.
