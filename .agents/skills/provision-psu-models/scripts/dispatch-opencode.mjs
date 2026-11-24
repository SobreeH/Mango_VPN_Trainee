#!/usr/bin/env node
/**
 * Cross-platform OpenCode worker dispatcher for `psu-dot-blue` models.
 *
 * - On Linux / macOS: launches `opencode run` inside a visible terminal window
 *   (konsole, alacritty, gnome-terminal, xfce4-terminal, kitty, wezterm, xterm)
 *   when a graphical display is reachable, or streams inline in `--no-window` mode.
 * - On Windows: delegates to sibling `dispatch-opencode.ps1` via pwsh/powershell.
 *
 * Never passes `--standalone` so the shared OpenCode service preserves its
 * 5-key rotation avoid map across runs.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const VALID_LOG_LEVELS = new Set([
  'all',
  'trace',
  'debug',
  'info',
  'warn',
  'warning',
  'error',
  'fatal',
  'none',
]);

const USAGE = `Usage: dispatch-opencode.sh --model <provider/model> --title <title> (--prompt <text> | --prompt-file <path>) [options]

Options (both --kebab-case and -PascalCase flags are accepted):
  --model, -Model <id>                   Model ID (e.g. psu-dot-blue/claude-haiku-5.5)
  --title, -Title <title>                Short run title
  --prompt, -Prompt <text>               Inline prompt text (mutually exclusive with --prompt-file)
  --prompt-file, -PromptFile <path>      Read prompt from UTF-8 file
  --worktree, -Worktree <slug>           Run inside an isolated git worktree (--worktree)
  --session, -Session <id>               Continue an existing OpenCode session (--session)
  --attach-file, -AttachFile <path>      Attach a file (-f) to the prompt
  --working-directory, -WorkingDirectory Working directory (default: current directory)
  --log-level, -LogLevel <level>         Log level (default: info)
  --keep-open, -KeepOpen[=bool]          Keep spawned terminal open after exit (default: true)
  --no-wait, -NoWait                     Return immediately with JSON run metadata
  --no-window, -NoWindow                 Run headless/inline in current shell (still logs to output.log)
  -h, --help                             Show this help`;

function parseBooleanValue(raw, fallback = true) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const norm = String(raw).trim().replace(/^:/, '').toLowerCase();
  if (['1', 'true', 'yes', '$true'].includes(norm)) return true;
  if (['0', 'false', 'no', '$false'].includes(norm)) return false;
  throw new Error(`Invalid boolean value: ${raw}`);
}

function parseArgs(argv) {
  const opts = {
    model: '',
    title: '',
    prompt: '',
    promptFile: '',
    worktree: '',
    session: '',
    attachFile: '',
    workingDirectory: process.cwd(),
    logLevel: 'info',
    keepOpen: true,
    noWait: false,
    noWindow: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '-h' || token === '--help' || token.toLowerCase() === '-help') {
      opts.help = true;
      continue;
    }

    let key = token;
    let inlineVal;
    const eqIdx = token.indexOf('=');
    const colonIdx = token.startsWith('-') && !token.startsWith('--') ? token.indexOf(':') : -1;
    if (eqIdx !== -1) {
      key = token.slice(0, eqIdx);
      inlineVal = token.slice(eqIdx + 1);
    } else if (colonIdx !== -1) {
      key = token.slice(0, colonIdx);
      inlineVal = token.slice(colonIdx + 1);
    }

    const normKey = key.replace(/^--?/, '').replace(/-/g, '').toLowerCase();
    const takeValue = () => {
      if (inlineVal !== undefined) return inlineVal;
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[++i];
    };

    switch (normKey) {
      case 'model':
        opts.model = takeValue();
        break;
      case 'title':
        opts.title = takeValue();
        break;
      case 'prompt':
        opts.prompt = takeValue();
        break;
      case 'promptfile':
        opts.promptFile = takeValue();
        break;
      case 'worktree':
        opts.worktree = takeValue();
        break;
      case 'session':
        opts.session = takeValue();
        break;
      case 'attachfile':
        opts.attachFile = takeValue();
        break;
      case 'workingdirectory':
        opts.workingDirectory = takeValue();
        break;
      case 'loglevel':
        opts.logLevel = takeValue().toLowerCase();
        break;
      case 'keepopen':
        opts.keepOpen = inlineVal !== undefined ? parseBooleanValue(inlineVal, true) : true;
        break;
      case 'nokeepopen':
        opts.keepOpen = false;
        break;
      case 'nowait':
        opts.noWait = inlineVal !== undefined ? parseBooleanValue(inlineVal, true) : true;
        break;
      case 'nowindow':
        opts.noWindow = inlineVal !== undefined ? parseBooleanValue(inlineVal, true) : true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return opts;
}

function delegateToWindowsPowerShell(opts) {
  const ps1Path = path.join(SCRIPT_DIR, 'dispatch-opencode.ps1');
  if (!fs.existsSync(ps1Path)) {
    throw new Error(`Windows dispatcher not found: ${ps1Path}`);
  }
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    ps1Path,
    '-Model',
    opts.model,
    '-Title',
    opts.title,
    '-WorkingDirectory',
    opts.workingDirectory,
    '-LogLevel',
    opts.logLevel,
  ];
  if (opts.prompt) args.push('-Prompt', opts.prompt);
  if (opts.promptFile) args.push('-PromptFile', opts.promptFile);
  if (opts.worktree) args.push('-Worktree', opts.worktree);
  if (opts.session) args.push('-Session', opts.session);
  if (opts.attachFile) args.push('-AttachFile', opts.attachFile);
  if (!opts.keepOpen) args.push('-KeepOpen:$false');
  if (opts.noWait) args.push('-NoWait');
  if (opts.noWindow) args.push('-NoWindow');

  const shell = findCommandOnPath('pwsh.exe') || findCommandOnPath('pwsh') || 'powershell.exe';
  const res = spawnSync(shell, args, { stdio: 'inherit' });
  process.exit(res.status ?? 1);
}

function findCommandOnPath(cmd) {
  const pathEnv = process.env.PATH || '';
  const dirs = pathEnv.split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, cmd);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // continue searching
    }
  }
  return null;
}

function bashSingleQuote(value) {
  return "'" + String(value).replace(/'/g, "'\"'\"'") + "'";
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM';
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTerminalCommand(resolvedWorkDir, safeTitle, runnerScript, keepOpen) {
  const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  if (!hasDisplay) return null;

  const title = `OpenCode: ${safeTitle}`;
  const candidates = [
    {
      name: 'konsole',
      buildArgs: (bin) => {
        const args = ['--separate', '--workdir', resolvedWorkDir];
        if (keepOpen) args.push('--hold');
        args.push('-e', 'bash', runnerScript);
        return { bin, args };
      },
    },
    {
      name: 'alacritty',
      buildArgs: (bin) => {
        const args = ['--working-directory', resolvedWorkDir, '-T', title];
        if (keepOpen) args.push('--hold');
        args.push('-e', 'bash', runnerScript);
        return { bin, args };
      },
    },
    {
      name: 'kitty',
      buildArgs: (bin) => {
        const args = ['--directory', resolvedWorkDir, '--title', title];
        if (keepOpen) args.push('--hold');
        args.push('bash', runnerScript);
        return { bin, args };
      },
    },
    {
      name: 'xfce4-terminal',
      buildArgs: (bin) => {
        const args = ['--working-directory', resolvedWorkDir, '--title', title];
        if (keepOpen) args.push('--hold');
        args.push('-e', `bash ${bashSingleQuote(runnerScript)}`);
        return { bin, args };
      },
    },
    {
      name: 'gnome-terminal',
      buildArgs: (bin) => {
        const cmd = keepOpen
          ? `bash ${bashSingleQuote(runnerScript)}; echo ""; read -rp "Press Enter to close..." _`
          : `bash ${bashSingleQuote(runnerScript)}`;
        return {
          bin,
          args: ['--working-directory', resolvedWorkDir, '--title', title, '--', 'bash', '-lc', cmd],
        };
      },
    },
    {
      name: 'wezterm',
      buildArgs: (bin) => {
        const cmd = keepOpen
          ? `bash ${bashSingleQuote(runnerScript)}; echo ""; read -rp "Press Enter to close..." _`
          : `bash ${bashSingleQuote(runnerScript)}`;
        return { bin, args: ['start', '--cwd', resolvedWorkDir, '--', 'bash', '-lc', cmd] };
      },
    },
    {
      name: 'xterm',
      buildArgs: (bin) => {
        const args = ['-T', title];
        if (keepOpen) args.push('-hold');
        args.push('-e', 'bash', runnerScript);
        return { bin, args };
      },
    },
  ];

  for (const candidate of candidates) {
    const bin = findCommandOnPath(candidate.name);
    if (bin) return { terminal: candidate.name, ...candidate.buildArgs(bin) };
  }
  return null;
}

function buildRunnerScript({
  pidPath,
  exitCodePath,
  logPath,
  promptPath,
  resolvedWorkDir,
  model,
  safeTitle,
  worktree,
  session,
  resolvedAttachFile,
  logLevel,
  worktreeLabel,
}) {
  return `#!/usr/bin/env bash
set -uo pipefail

PID_FILE=${bashSingleQuote(pidPath)}
EXIT_FILE=${bashSingleQuote(exitCodePath)}
LOG_FILE=${bashSingleQuote(logPath)}
PROMPT_FILE=${bashSingleQuote(promptPath)}
WORK_DIR=${bashSingleQuote(resolvedWorkDir)}
MODEL=${bashSingleQuote(model)}
RUN_TITLE=${bashSingleQuote(safeTitle)}
WORKTREE=${bashSingleQuote(worktree)}
SESSION_ID=${bashSingleQuote(session)}
ATTACH_FILE=${bashSingleQuote(resolvedAttachFile)}
LOG_LEVEL=${bashSingleQuote(logLevel)}
WORKTREE_LABEL=${bashSingleQuote(worktreeLabel)}

printf '%s' "$$" > "$PID_FILE"
cd "$WORK_DIR" || exit 1

START_EPOCH=$(date +%s)
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

printf '\\033]0;OpenCode: %s [%s]\\007' "$RUN_TITLE" "$MODEL" 2>/dev/null || true

echo '========================================================================'
echo " OpenCode Worker : $RUN_TITLE"
echo " Model           : $MODEL"
echo " Working Dir     : $WORK_DIR"
echo " Isolation       : $WORKTREE_LABEL"
echo " Log Level       : $LOG_LEVEL (--thinking --print-logs)"
echo " Log File        : $LOG_FILE"
echo " Started         : $START_TIME"
echo '========================================================================'
echo ''

PROMPT_CONTENT=$(cat "$PROMPT_FILE")
OC_ARGS=(
  run
  -m "$MODEL"
  --auto
  --archived
  --thinking
  --print-logs
  --log-level "$LOG_LEVEL"
  --title "$RUN_TITLE"
)
if [[ -n "$WORKTREE" ]]; then
  OC_ARGS+=(--worktree "$WORKTREE")
fi
if [[ -n "$SESSION_ID" ]]; then
  OC_ARGS+=(--session "$SESSION_ID")
fi
if [[ -n "$ATTACH_FILE" ]]; then
  OC_ARGS+=(-f "$ATTACH_FILE")
fi
OC_ARGS+=("$PROMPT_CONTENT")

EXIT_CODE=1
set +o pipefail
opencode "\${OC_ARGS[@]}" < /dev/null 2>&1 | tee "$LOG_FILE"
EXIT_CODE=\${PIPESTATUS[0]}
set -o pipefail

printf '%s' "$EXIT_CODE" > "$EXIT_FILE"

END_EPOCH=$(date +%s)
ELAPSED=$((END_EPOCH - START_EPOCH))
printf -v ELAPSED_FMT '%02d:%02d:%02d' $((ELAPSED / 3600)) $(((ELAPSED % 3600) / 60)) $((ELAPSED % 60))

echo ''
echo '========================================================================'
echo " Completed       : Exit Code $EXIT_CODE (Elapsed: $ELAPSED_FMT)"
echo " Log File        : $LOG_FILE"
echo '========================================================================'

exit "$EXIT_CODE"
`;
}

function runInline(runnerScript, resolvedWorkDir, metadata, noWait) {
  if (noWait) {
    const child = spawn('bash', [runnerScript], {
      cwd: resolvedWorkDir,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    console.log(JSON.stringify(metadata));
    process.exit(0);
  }

  const res = spawnSync('bash', [runnerScript], {
    cwd: resolvedWorkDir,
    stdio: 'inherit',
  });
  process.exit(res.status ?? 1);
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(USAGE);
    process.exit(2);
  }

  if (opts.help) {
    console.log(USAGE);
    return;
  }

  if (!opts.model.trim()) {
    console.error('Missing required --model option.');
    process.exit(2);
  }
  if (!opts.title.trim()) {
    console.error('Missing required --title option.');
    process.exit(2);
  }
  if (!VALID_LOG_LEVELS.has(opts.logLevel)) {
    console.error(`Invalid --log-level '${opts.logLevel}'.`);
    process.exit(2);
  }

  const hasPrompt = Boolean(opts.prompt && opts.prompt.trim());
  const hasPromptFile = Boolean(opts.promptFile && opts.promptFile.trim());
  if (!hasPrompt && !hasPromptFile) {
    console.error('Either --prompt or --prompt-file must be provided.');
    process.exit(2);
  }
  if (hasPrompt && hasPromptFile) {
    console.error('Specify either --prompt or --prompt-file, not both.');
    process.exit(2);
  }

  if (process.platform === 'win32') {
    delegateToWindowsPowerShell(opts);
    return;
  }

  if (!findCommandOnPath('opencode')) {
    console.error('opencode CLI was not found on PATH.');
    process.exit(1);
  }

  if (!fs.existsSync(opts.workingDirectory) || !fs.statSync(opts.workingDirectory).isDirectory()) {
    console.error(`WorkingDirectory does not exist: ${opts.workingDirectory}`);
    process.exit(1);
  }
  const resolvedWorkDir = fs.realpathSync(opts.workingDirectory);

  let resolvedAttachFile = '';
  if (opts.attachFile && opts.attachFile.trim()) {
    if (!fs.existsSync(opts.attachFile) || !fs.statSync(opts.attachFile).isFile()) {
      console.error(`AttachFile does not exist: ${opts.attachFile}`);
      process.exit(1);
    }
    resolvedAttachFile = fs.realpathSync(opts.attachFile);
  }

  let promptText = opts.prompt;
  if (hasPromptFile) {
    if (!fs.existsSync(opts.promptFile) || !fs.statSync(opts.promptFile).isFile()) {
      console.error(`PromptFile does not exist: ${opts.promptFile}`);
      process.exit(1);
    }
    promptText = fs.readFileSync(opts.promptFile, 'utf8');
  }
  if (!promptText.trim()) {
    console.error('Prompt text cannot be empty.');
    process.exit(1);
  }

  const timestamp = formatTimestamp(new Date());
  let slug = opts.title
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) slug = 'opencode-run';
  if (slug.length > 32) slug = slug.slice(0, 32).replace(/-+$/g, '');

  const shortId = crypto.randomBytes(4).toString('hex');
  const baseTempDir = path.join(os.tmpdir(), 'opencode-dispatch');
  const runDir = path.join(baseTempDir, `${timestamp}-${slug}-${shortId}`);
  fs.mkdirSync(runDir, { recursive: true });

  const promptPath = path.join(runDir, 'prompt.txt');
  const runnerScript = path.join(runDir, 'runner.sh');
  const logPath = path.join(runDir, 'output.log');
  const pidPath = path.join(runDir, 'runner.pid');
  const exitCodePath = path.join(runDir, 'exit.code');
  const tailCommand = `tail -f ${bashSingleQuote(logPath)}`;

  fs.writeFileSync(promptPath, promptText.replace(/^\uFEFF/, ''), 'utf8');

  const worktreeLabel = opts.worktree.trim() || 'in-place';
  const safeTitle = opts.title.replace(/[\r\n;"]+/g, ' ').trim() || 'OpenCode Worker';

  const runnerBody = buildRunnerScript({
    pidPath,
    exitCodePath,
    logPath,
    promptPath,
    resolvedWorkDir,
    model: opts.model,
    safeTitle,
    worktree: opts.worktree.trim(),
    session: opts.session.trim(),
    resolvedAttachFile,
    logLevel: opts.logLevel,
    worktreeLabel,
  });
  fs.writeFileSync(runnerScript, runnerBody, { encoding: 'utf8', mode: 0o755 });

  const metadata = {
    runDir,
    logFile: logPath,
    exitCodeFile: exitCodePath,
    pidFile: pidPath,
    model: opts.model,
    title: safeTitle,
    worktree: worktreeLabel,
    tailCommand,
  };

  const termLaunch = opts.noWindow
    ? null
    : buildTerminalCommand(resolvedWorkDir, safeTitle, runnerScript, opts.keepOpen);

  if (!termLaunch) {
    console.log(
      opts.noWindow
        ? `Running OpenCode headless | Model: ${opts.model} | Title: ${safeTitle} | Log: ${logPath}`
        : `No graphical terminal available; running inline | Model: ${opts.model} | Title: ${safeTitle} | Log: ${logPath}`,
    );
    console.log(`Watch live in another terminal: ${tailCommand}`);
    runInline(runnerScript, resolvedWorkDir, metadata, opts.noWait);
    return;
  }

  const termProc = spawn(termLaunch.bin, termLaunch.args, {
    cwd: resolvedWorkDir,
    detached: true,
    stdio: 'ignore',
  });
  termProc.unref();

  console.log(
    `Dispatched OpenCode in ${termLaunch.terminal} | Model: ${opts.model} | Title: ${safeTitle} | Isolation: ${worktreeLabel} | Log: ${logPath}`,
  );

  if (opts.noWait) {
    console.log(JSON.stringify(metadata));
    return;
  }

  const pidDeadline = Date.now() + 8000;
  while (!fs.existsSync(pidPath) && Date.now() < pidDeadline) {
    await sleepMs(200);
  }

  if (!fs.existsSync(pidPath)) {
    console.warn(
      `Terminal '${termLaunch.terminal}' did not start runner within 8s (falling back to inline run).`,
    );
    try {
      termProc.kill();
    } catch {
      // ignore
    }
    runInline(runnerScript, resolvedWorkDir, metadata, false);
    return;
  }

  const runnerPid = Number.parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
  if (!Number.isInteger(runnerPid) || runnerPid <= 0) {
    console.error(`Invalid runner PID in ${pidPath}`);
    process.exit(1);
  }

  while (!fs.existsSync(exitCodePath)) {
    if (!isPidAlive(runnerPid)) {
      await sleepMs(500);
      if (!fs.existsSync(exitCodePath)) {
        console.error(
          `OpenCode terminal (PID ${runnerPid}) closed before completion. Partial log: ${logPath}`,
        );
        process.exit(1);
      }
      break;
    }
    await sleepMs(500);
  }

  const exitText = fs.readFileSync(exitCodePath, 'utf8').trim();
  const workerExitCode = Number.parseInt(exitText, 10);
  const finalExit = Number.isInteger(workerExitCode) ? workerExitCode : 1;

  console.log(`OpenCode run finished | Exit Code: ${finalExit} | Log: ${logPath}`);
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/);
    console.log('--- Tail of output.log (last 40 lines) ---');
    console.log(lines.slice(-40).join('\n'));
  }

  process.exit(finalExit);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
