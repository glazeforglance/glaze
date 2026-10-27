import { useId, useState } from "react";
import { useWatch } from "react-hook-form";
import { TextField } from "../../forms/fields/TextField.tsx";
import { FieldWarning } from "../../forms/SchemaField.tsx";
import { isEnvReference } from "../../forms/schema.ts";
import { useWidgetForm } from "../../forms/use-widget-form.ts";
import { hashGlancePassword } from "../../lib/api.ts";
import {
	makeSecretKey,
	maskSecret,
	usernameProblem,
} from "../../lib/glance-settings.ts";
import { Button } from "../ui/Button.tsx";
import { ConfirmDialog } from "../ui/ConfirmDialog.tsx";
import { INPUT_CLASS, borderClass } from "../../forms/fields/field-styles.ts";

const USERS = ["auth", "users"] as const;

function record(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

/**
 * Glance's own login (`auth:`): the secret key that signs sessions, and the
 * users with their passwords. Passwords are stored as bcrypt hashes (made by
 * Glance's `password:hash`, or bcrypt at Glance's cost), never as text, and
 * existing hashes are only shown shortened.
 * @returns The section.
 */
export function AuthSection() {
	const { form, target } = useWidgetForm();
	const auth = record(useWatch({ control: form.control, name: "auth" }));
	const users = record(auth.users);
	const names = Object.keys(users);
	const secret =
		typeof auth["secret-key"] === "string" ? auth["secret-key"] : "";
	const [confirmingKey, setConfirmingKey] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);

	const writeKey = () => {
		if (target.set(["auth", "secret-key"], makeSecretKey())) {
			setNotice(
				"A new secret key is set. Publishing logs everyone out of Glance.",
			);
		}
	};

	return (
		<>
			<section aria-label="Secret key" className="mb-8">
				<h2 className="mb-1 text-base font-semibold">Secret key</h2>
				<p className="mb-3 text-sm text-muted">
					Signs Glance's login sessions. Glance needs one as soon as there are
					users; changing it logs everyone out.
				</p>
				{names.length > 0 && secret === "" && (
					<FieldWarning text="Glance refuses users without a secret key. Generate one below." />
				)}
				{secret !== "" && !isEnvReference(secret) && (
					<p className="mb-2 font-mono text-xs text-faint">
						Set: {maskSecret(secret)}
					</p>
				)}
				<TextField
					name="auth.secret-key"
					label="Secret key"
					secret
					hint="Or ${GLANCE_SECRET_KEY} to keep it out of glance.yml."
				/>
				<Button
					variant="secondary"
					onClick={() => (secret === "" ? writeKey() : setConfirmingKey(true))}
				>
					Generate a new key
				</Button>
				{notice && (
					<p role="status" className="mt-2 text-xs text-accent">
						{notice}
					</p>
				)}
				<ConfirmDialog
					open={confirmingKey}
					title="Replace the secret key?"
					confirmLabel="Generate a new key"
					onCancel={() => setConfirmingKey(false)}
					onConfirm={() => {
						setConfirmingKey(false);
						writeKey();
					}}
				>
					Once you publish, everyone who is logged in to Glance has to log in
					again.
				</ConfirmDialog>
			</section>

			<section aria-label="Users">
				<h2 className="mb-1 text-base font-semibold">Users</h2>
				<p className="mb-3 text-sm text-muted">
					Glance shows every page to every user; it has no per-page access.
				</p>
				<ul className="mb-4 flex flex-col gap-2">
					{names.map((name) => (
						<UserRow
							key={name}
							name={name}
							user={record(users[name])}
							others={names.filter((other) => other !== name)}
							isLast={names.length === 1}
						/>
					))}
					{names.length === 0 && (
						<li className="text-sm text-faint">
							No users: anyone who can reach Glance sees the dashboard.
						</li>
					)}
				</ul>
				<AddUser
					existing={names}
					needsKey={secret === ""}
					onKeyAdded={() =>
						setNotice(
							"Glance needs a secret key for users, so one was generated.",
						)
					}
				/>
			</section>
		</>
	);
}

function UserRow({
	name,
	user,
	others,
	isLast,
}: {
	readonly name: string;
	readonly user: Record<string, unknown>;
	readonly others: readonly string[];
	readonly isLast: boolean;
}) {
	const { target } = useWidgetForm();
	const hash =
		typeof user["password-hash"] === "string" ? user["password-hash"] : "";
	const plain = typeof user.password === "string" ? user.password : "";
	const [renaming, setRenaming] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const rename = () => {
		if (renaming === null) return;
		const next = renaming.trim();
		if (next === name) {
			setRenaming(null);
			return;
		}
		const problem = usernameProblem(next, others);
		if (problem) {
			setError(problem);
			return;
		}
		if (target.rename([...USERS], name, next)) {
			setRenaming(null);
			setError(null);
		}
	};

	return (
		<li className="rounded-md border border-line bg-card p-3">
			<div className="flex items-center gap-2">
				{renaming === null ? (
					<span className="flex-1 font-mono text-sm font-semibold">{name}</span>
				) : (
					<input
						aria-label={`New name for ${name}`}
						value={renaming}
						onChange={(event) => setRenaming(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") rename();
							if (event.key === "Escape") setRenaming(null);
						}}
						className={`${INPUT_CLASS} ${borderClass(error !== null)} min-h-9 flex-1 font-mono text-[13px]`}
					/>
				)}
				{renaming === null ? (
					<Button variant="secondary" onClick={() => setRenaming(name)}>
						Rename
					</Button>
				) : (
					<Button variant="secondary" onClick={rename}>
						Save name
					</Button>
				)}
				<Button
					variant="secondary"
					onClick={() => target.remove(isLast ? [...USERS] : [...USERS, name])}
				>
					Remove
				</Button>
			</div>
			<p className="mt-2 text-xs text-faint">
				{hash !== ""
					? isEnvReference(hash)
						? `Password hash from ${hash}.`
						: `Password set (bcrypt hash ${maskSecret(hash)}).`
					: plain !== ""
						? "The password is stored as plain text; set it again to store a hash instead."
						: "No password: Glance refuses this user until it has one."}
			</p>
			{error && (
				<p role="alert" className="mt-1 text-xs text-danger">
					{error}
				</p>
			)}
			<PasswordForm
				label={`New password for ${name}`}
				buttonLabel="Set password"
				onHash={(newHash) => {
					const ok = target.set([...USERS, name, "password-hash"], newHash);
					// The plain text password would win over nothing; drop it.
					if (ok && plain !== "") target.remove([...USERS, name, "password"]);
					return ok;
				}}
			/>
		</li>
	);
}

function PasswordForm({
	label,
	buttonLabel,
	onHash,
}: {
	readonly label: string;
	readonly buttonLabel: string;
	readonly onHash: (hash: string) => boolean;
}) {
	const id = useId();
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async () => {
		setBusy(true);
		const result = await hashGlancePassword(password);
		setBusy(false);
		if (!result.ok) {
			setError(result.error.message);
			return;
		}
		if (onHash(result.value)) {
			setPassword("");
			setError(null);
		}
	};

	return (
		<div className="mt-3">
			<label htmlFor={id} className="sr-only">
				{label}
			</label>
			<div className="flex gap-2">
				<input
					id={id}
					type="password"
					value={password}
					placeholder="At least 6 characters"
					autoComplete="new-password"
					aria-invalid={error ? true : undefined}
					onChange={(event) => {
						setPassword(event.target.value);
						setError(null);
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter" && password !== "") {
							event.preventDefault();
							void submit();
						}
					}}
					className={`${INPUT_CLASS} ${borderClass(error !== null)}`}
				/>
				<Button
					variant="secondary"
					disabled={busy || password === ""}
					onClick={() => void submit()}
					className="shrink-0"
				>
					{busy ? "Hashing…" : buttonLabel}
				</Button>
			</div>
			{error && (
				<p role="alert" className="mt-1 text-xs text-danger">
					{error}
				</p>
			)}
		</div>
	);
}

function AddUser({
	existing,
	needsKey,
	onKeyAdded,
}: {
	readonly existing: readonly string[];
	readonly needsKey: boolean;
	readonly onKeyAdded: () => void;
}) {
	const { target } = useWidgetForm();
	const id = useId();
	const [name, setName] = useState("");
	const problem = name === "" ? null : usernameProblem(name, existing);

	return (
		<div className="rounded-md border border-dashed border-line-strong p-3">
			<h3 className="mb-2 text-sm font-semibold">Add a user</h3>
			<label htmlFor={id} className="mb-1 block text-xs text-muted">
				User name
			</label>
			<input
				id={id}
				value={name}
				autoComplete="off"
				spellCheck={false}
				aria-invalid={problem ? true : undefined}
				onChange={(event) => setName(event.target.value)}
				className={`${INPUT_CLASS} ${borderClass(problem !== null)} font-mono text-[13px]`}
			/>
			{problem && (
				<p role="alert" className="mt-1 text-xs text-danger">
					{problem}
				</p>
			)}
			<PasswordForm
				label={`Password for ${name || "the new user"}`}
				buttonLabel="Add user"
				onHash={(hash) => {
					const trimmed = name.trim();
					if (usernameProblem(trimmed, existing) !== null) return false;
					const ok = target.set([...USERS, trimmed], { "password-hash": hash });
					// Glance refuses users without a secret key; give it one right away.
					if (
						ok &&
						needsKey &&
						target.set(["auth", "secret-key"], makeSecretKey())
					) {
						onKeyAdded();
					}
					if (ok) setName("");
					return ok;
				}}
			/>
		</div>
	);
}
