import { hashPassword } from "./password.ts";

/** Shorter passwords are refused; the README recommends a long passphrase. */
export const MIN_PASSWORD_LENGTH = 8;

const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = new Set(["\u007f", "\b"]);

/**
 * Reads one line from a terminal without echoing it, by switching the
 * terminal to raw mode and handling Enter, Backspace and Ctrl+C ourselves.
 * @param prompt - Shown on stderr, so stdout only ever holds the hash.
 * @returns The typed text, or `null` when the user pressed Ctrl+C.
 */
function readHidden(prompt: string): Promise<string | null> {
	const { stdin, stderr } = process;
	stderr.write(prompt);
	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding("utf8");
	return new Promise((resolve) => {
		let typed = "";
		const finish = (value: string | null) => {
			stdin.off("data", onData);
			stdin.setRawMode(false);
			stdin.pause();
			stderr.write("\n");
			resolve(value);
		};
		const onData = (chunk: string) => {
			for (const char of chunk) {
				if (char === "\r" || char === "\n" || char === CTRL_D) {
					finish(typed);
					return;
				}
				if (char === CTRL_C) {
					finish(null);
					return;
				}
				if (BACKSPACE.has(char)) typed = typed.slice(0, -1);
				else typed += char;
			}
		};
		stdin.on("data", onData);
	});
}

/** Reads piped stdin (e.g. `printf 'pw\npw\n' | hash-password`) as lines. */
async function readPipedLines(): Promise<string[]> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	}
	return Buffer.concat(chunks)
		.toString("utf8")
		.split(/\r?\n/)
		.filter((line, index, lines) => line !== "" || index < lines.length - 1);
}

/**
 * Checks a new password and its confirmation.
 * @param password - First entry.
 * @param confirmation - Second entry, or `null` when there was none (piped input).
 * @returns An error message, or `null` when the password can be used.
 */
export function checkNewPassword(
	password: string,
	confirmation: string | null,
): string | null {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return `Use at least ${MIN_PASSWORD_LENGTH} characters (a long passphrase is best).`;
	}
	if (confirmation !== null && confirmation !== password) {
		return "The passwords don't match.";
	}
	return null;
}

/**
 * The `hash-password` command: asks for a password twice (without echo),
 * then prints its scrypt hash for `GLAZE_ADMIN_PASSWORD_HASH` on stdout.
 * With piped input it reads the first line (and checks it against the second, if any).
 * @returns The process exit code.
 */
export async function runHashPassword(): Promise<number> {
	let password: string;
	let confirmation: string | null;
	if (process.stdin.isTTY) {
		const first = await readHidden("New Glaze password: ");
		if (first === null) return 130;
		const second = await readHidden("Repeat the password: ");
		if (second === null) return 130;
		password = first;
		confirmation = second;
	} else {
		const lines = await readPipedLines();
		password = lines[0] ?? "";
		confirmation = lines[1] ?? null;
	}
	const problem = checkNewPassword(password, confirmation);
	if (problem !== null) {
		process.stderr.write(`${problem}\n`);
		return 1;
	}
	const hash = await hashPassword(password);
	process.stdout.write(`${hash}\n`);
	if (process.stdout.isTTY) {
		process.stderr.write(
			"\nSet GLAZE_ADMIN_PASSWORD_HASH to the line above. In .env files, wrap it in\nsingle quotes ('scrypt$…'), so the $ signs aren't read as variables.\n",
		);
	}
	return 0;
}
