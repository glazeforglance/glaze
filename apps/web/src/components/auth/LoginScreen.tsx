import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { GLAZE_VERSION } from "../../lib/version.ts";
import { authStore, useAuth } from "../../store/auth-store.ts";
import { borderClass, INPUT_CLASS } from "../../forms/fields/field-styles.ts";
import { Button } from "../ui/Button.tsx";
import { GlazeMark } from "../ui/icons.tsx";
import { useTranslation } from "react-i18next";
import { LanguageSelect } from "../ui/LanguageSelect.tsx";

export interface LoginFormProps {
	/** Shown above the form, e.g. why the user has to log in again. */
	readonly notice?: string;
}

/**
 * The login form: username, password, an error line and a submit button.
 * The password is cleared after a failed attempt; the username is kept.
 * @param props - An optional notice.
 * @returns The form.
 */
function LoginForm({ notice }: LoginFormProps) {
	const { t } = useTranslation();
	const lastUser = useAuth((state) => state.user);
	const [username, setUsername] = useState(lastUser ?? "admin");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const passwordRef = useRef<HTMLInputElement>(null);
	const id = useId();

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setError(null);
		const result = await authStore.getState().logIn(username, password);
		setBusy(false);
		if (!result.ok) {
			setError(result.error.message);
			setPassword("");
			passwordRef.current?.focus();
		}
	};

	return (
		<form
			onSubmit={(event) => void submit(event)}
			className="flex w-full flex-col gap-4"
			aria-describedby={notice ? `${id}-notice` : undefined}
		>
			<div className="flex flex-col items-center gap-3 text-center">
				<GlazeMark className="size-11" />
				<h1 className="text-xl font-bold tracking-tight">{t("login.title")}</h1>
				{notice && (
					<p id={`${id}-notice`} className="text-sm text-muted">
						{notice}
					</p>
				)}
			</div>
			<label className="flex flex-col gap-1.5 text-sm">
				<span className="font-mono text-xs text-muted">
					{t("login.username")}
				</span>
				<input
					name="username"
					dir="auto"
					autoComplete="username"
					autoCapitalize="none"
					spellCheck={false}
					required
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					className={`${INPUT_CLASS} ${borderClass(false)}`}
				/>
			</label>
			<label className="flex flex-col gap-1.5 text-sm">
				<span className="font-mono text-xs text-muted">
					{t("login.password")}
				</span>
				<input
					ref={passwordRef}
					name="password"
					type="password"
					autoComplete="current-password"
					required
					autoFocus
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					aria-invalid={error !== null}
					aria-describedby={error ? `${id}-error` : undefined}
					className={`${INPUT_CLASS} ${borderClass(error !== null)}`}
				/>
			</label>
			<p
				id={`${id}-error`}
				role="alert"
				className="min-h-5 text-sm text-danger empty:min-h-0"
			>
				{error}
			</p>
			<Button
				type="submit"
				variant="primary"
				unavailable={busy ? t("login.busy") : undefined}
				className="min-h-11"
			>
				{busy ? t("login.busy") : t("login.submit")}
			</Button>
		</form>
	);
}

/**
 * The full-page login screen, shown when there's no session on startup.
 * @returns The screen.
 */
export function LoginScreen() {
	return (
		<main className="dotted-grid flex h-full flex-col items-center justify-center gap-6 px-4">
			<div className="w-full max-w-sm rounded-lg border border-line bg-card p-6 shadow-2xl shadow-black/40">
				<LoginForm />
			</div>
			<div className="flex items-center gap-4">
				<LanguageSelect />
				<p dir="ltr" className="font-mono text-[11px] text-faint">
					Glaze v{GLAZE_VERSION}
				</p>
			</div>
		</main>
	);
}

/**
 * The login form on top of the editor, after the session ended mid-work.
 * A modal `<dialog>`: the editor underneath is inert, but it stays mounted,
 * so unsaved edits, the code draft and open file tabs are all still there.
 * Escape doesn't close it: without a session nothing would work anyway.
 * @returns The overlay.
 */
export function LoginOverlay() {
	const { t } = useTranslation();
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = ref.current;
		if (dialog && !dialog.open) dialog.showModal();
		// showModal() focuses the first field (username); the password is what's needed.
		dialog?.querySelector<HTMLInputElement>('input[type="password"]')?.focus();
		return () => dialog?.close();
	}, []);
	return (
		<dialog
			ref={ref}
			aria-label={t("login.again")}
			onCancel={(event) => event.preventDefault()}
			className="m-auto w-[min(400px,calc(100vw-32px))] rounded-lg border border-line-strong bg-card p-6 text-text shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
		>
			<LoginForm notice={t("login.sessionEnded")} />
		</dialog>
	);
}
