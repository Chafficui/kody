/**
 * Tiny readline-based prompt helpers.
 *
 * We deliberately do not depend on `inquirer` to keep the install small.
 * Each helper returns a Promise and supports an optional default.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

let rl: ReturnType<typeof createInterface> | null = null;

function getRl(): ReturnType<typeof createInterface> {
  if (!rl) {
    rl = createInterface({ input: stdin, output: stdout });
  }
  return rl;
}

export async function closeRl(): Promise<void> {
  if (rl) {
    rl.close();
    rl = null;
  }
}

/** Thrown when a prompt is invoked on a non-TTY stdin (e.g. piped input). */
function nonInteractiveError(label: string): Error {
  return new Error(
    `Cannot prompt for ${label} on non-interactive stdin. Pass the value as a flag or via the matching environment variable.`,
  );
}

/** Ask a free-form question. Returns the trimmed answer, or default on empty. */
export async function ask(question: string, fallback?: string): Promise<string> {
  if (!stdin.isTTY) {
    throw nonInteractiveError(`"${question}"`);
  }
  const suffix = fallback ? ` [${fallback}]` : "";
  const r = getRl();
  const answer = (await r.question(`${question}${suffix}: `)).trim();
  return answer || fallback || "";
}

/** Ask a yes/no question. Default is "yes" if the user just hits enter. */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  if (!stdin.isTTY) {
    throw nonInteractiveError(`yes/no "${question}"`);
  }
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const r = getRl();
  const answer = (await r.question(`${question} ${hint}: `)).trim().toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}

/**
 * Ask a sensitive question (API key, password, etc.) with echo disabled.
 *
 * Falls back to a visible prompt on a non-TTY stdin rather than echoing
 * the secret on screen — callers that need a hard guarantee of privacy
 * should pass the value as a flag or env var instead.
 */
export async function askSecret(question: string, fallback?: string): Promise<string> {
  if (!stdin.isTTY) {
    throw nonInteractiveError(`secret "${question}"`);
  }
  const suffix = fallback ? ` [${fallback}]` : "";
  // Emit the prompt manually so we never need the readline `output` stream
  // (which is what would cause the secret to echo on some terminals).
  process.stdout.write(`${question}${suffix}: `);
  const r = getRl();
  // Mute the readline output stream while the user types so the keystrokes
  // are not echoed to the terminal.
  const saved = (r as unknown as { output?: NodeJS.WritableStream }).output;
  (r as unknown as { output: NodeJS.WritableStream | null }).output = null;
  try {
    const answer = (await r.question("")).trim();
    process.stdout.write("\n");
    return answer || fallback || "";
  } finally {
    (r as unknown as { output: NodeJS.WritableStream | null | undefined }).output = saved;
  }
}

/**
 * Ask the user to pick one of the given options. Returns the index, or the
 * default index on empty input. Throws on non-interactive stdin so the CLI
 * can fall back to a non-interactive mode.
 */
export async function choose(question: string, options: string[], defaultIndex = 0): Promise<number> {
  if (!stdin.isTTY) {
    throw new Error("Cannot prompt for choice on non-interactive stdin. Use --non-interactive with explicit flags.");
  }
  console.log(question);
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? "*" : " ";
    console.log(`  ${marker} ${i + 1}. ${opt}`);
  });
  const r = getRl();
  const raw = (await r.question(`Choose [1-${options.length}] (default ${defaultIndex + 1}): `)).trim();
  if (raw === "") return defaultIndex;
  const idx = parseInt(raw, 10);
  if (Number.isNaN(idx) || idx < 1 || idx > options.length) {
    throw new Error(`Invalid choice: ${raw}`);
  }
  return idx - 1;
}
