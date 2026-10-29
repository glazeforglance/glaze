import { useId, useState } from "react";
import { PlusIcon, TrashIcon } from "../../components/ui/icons.tsx";
import { sameValue } from "../paths.ts";
import { useWidgetField } from "../use-widget-form.ts";
import { convertShape, shapeOf, type ValueShape } from "../values.ts";
import { borderClass, INPUT_CLASS } from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";
import { i18n } from "../../i18n.ts";

/** The shapes a value can take; labels are `forms.any.<shape>`. */
const SHAPES: readonly Exclude<ValueShape, "empty">[] = [
	"text",
	"number",
	"boolean",
	"list",
	"map",
];

const SMALL_BUTTON =
	"inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-card-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40";

export interface AnyFieldProps {
	readonly name: string;
	readonly label: string;
	readonly hint?: string;
}

/**
 * Any YAML value (custom-api `body`, option values): a type select per value
 * (text, number, yes/no, list, map) and nested editors for lists and maps.
 * Changes collect in a draft and are written when focus leaves the field, or
 * right away for structural changes (type, add, remove), so one visit is one edit.
 * @param props - Field name and label.
 * @returns The field element.
 */
export function AnyField({ name, label, hint }: AnyFieldProps) {
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	// The draft remembers the document value it started from: when the
	// document changes (another edit), that value is shown again.
	const [state, setState] = useState<{ base: unknown; draft: unknown }>({
		base: field.value,
		draft: field.value,
	});
	const draft = sameValue(state.base, field.value) ? state.draft : field.value;
	const setDraft = (value: unknown) =>
		setState({ base: field.value, draft: value });

	const write = (value: unknown) => {
		setDraft(value);
		if (!sameValue(value, field.value)) widgetField.commit(value);
	};

	return (
		<FieldShell
			name={name}
			inputId={id}
			label={label}
			asGroup
			status={widgetField.status}
			env={widgetField.env}
			error={error}
			hint={hint}
			readOnly={widgetField.readOnly}
			onOverride={widgetField.override}
		>
			<div
				role="group"
				aria-labelledby={`${id}-label`}
				onBlur={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) write(draft);
				}}
			>
				<ValueEditor
					value={draft === undefined ? null : draft}
					label={label}
					disabled={disabled}
					onDraft={setDraft}
					onWrite={write}
				/>
			</div>
		</FieldShell>
	);
}

interface ValueEditorProps {
	readonly value: unknown;
	readonly label: string;
	readonly disabled: boolean;
	/** A change while typing (written later, on blur). */
	readonly onDraft: (value: unknown) => void;
	/** A structural change, written right away. */
	readonly onWrite: (value: unknown) => void;
}

function ValueEditor({
	value,
	label,
	disabled,
	onDraft,
	onWrite,
}: ValueEditorProps) {
	const shape = shapeOf(value);
	return (
		<div className="flex flex-col gap-2">
			<div className="flex gap-2">
				<select
					aria-label={i18n.t("forms.any.typeOf", { label })}
					value={shape === "empty" ? "text" : shape}
					disabled={disabled}
					onChange={(event) =>
						onWrite(convertShape(value, event.target.value as ValueShape))
					}
					className={`${INPUT_CLASS} ${borderClass(false)} w-28 shrink-0 cursor-pointer`}
				>
					{SHAPES.map((option) => (
						<option key={option} value={option}>
							{i18n.t(`forms.any.${option}`)}
						</option>
					))}
				</select>
				{(shape === "text" || shape === "empty") && (
					<input
						aria-label={label}
						value={value === null ? "" : String(value)}
						disabled={disabled}
						spellCheck={false}
						onChange={(event) => onDraft(event.target.value)}
						className={`${INPUT_CLASS} ${borderClass(false)} min-w-0 font-mono text-[13px]`}
					/>
				)}
				{shape === "number" && (
					<input
						aria-label={label}
						inputMode="decimal"
						value={String(value)}
						disabled={disabled}
						onChange={(event) => {
							const number = Number(event.target.value);
							onDraft(Number.isFinite(number) ? number : event.target.value);
						}}
						className={`${INPUT_CLASS} ${borderClass(false)} min-w-0 font-mono text-[13px]`}
					/>
				)}
				{shape === "boolean" && (
					<label className="flex min-h-10 items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={value === true}
							disabled={disabled}
							onChange={(event) => onWrite(event.target.checked)}
							className="size-4 cursor-pointer accent-[var(--color-accent)]"
						/>
						{value === true ? "true" : "false"}
					</label>
				)}
			</div>
			{shape === "list" && (
				<ListEditor
					items={value as unknown[]}
					label={label}
					disabled={disabled}
					onDraft={onDraft}
					onWrite={onWrite}
				/>
			)}
			{shape === "map" && (
				<MapEditor
					entries={value as Record<string, unknown>}
					label={label}
					disabled={disabled}
					onDraft={onDraft}
					onWrite={onWrite}
				/>
			)}
		</div>
	);
}

function ListEditor({
	items,
	label,
	disabled,
	onDraft,
	onWrite,
}: {
	readonly items: readonly unknown[];
	readonly label: string;
	readonly disabled: boolean;
	readonly onDraft: (value: unknown) => void;
	readonly onWrite: (value: unknown) => void;
}) {
	const replace = (index: number, item: unknown) =>
		items.map((current, i) => (i === index ? item : current));
	return (
		<div className="ms-3 flex flex-col gap-2 border-s border-line ps-3">
			{items.map((item, index) => (
				// Items have no ids; the index is their identity, as in the YAML.
				<div key={index} className="flex items-start gap-1">
					<div className="min-w-0 flex-1">
						<ValueEditor
							value={item}
							label={`${label} ${index + 1}`}
							disabled={disabled}
							onDraft={(next) => onDraft(replace(index, next))}
							onWrite={(next) => onWrite(replace(index, next))}
						/>
					</div>
					<button
						type="button"
						aria-label={i18n.t("forms.any.removeItem", {
							label,
							number: index + 1,
						})}
						disabled={disabled}
						onClick={() => onWrite(items.filter((_, i) => i !== index))}
						className={`${SMALL_BUTTON} hover:text-danger`}
					>
						<TrashIcon />
					</button>
				</div>
			))}
			<button
				type="button"
				disabled={disabled}
				onClick={() => onWrite([...items, ""])}
				className="inline-flex min-h-8 w-fit cursor-pointer items-center gap-1.5 rounded-[6px] px-2 text-xs text-accent hover:bg-accent/10 disabled:cursor-not-allowed"
			>
				<PlusIcon className="size-3" /> {i18n.t("forms.any.addItem")}
			</button>
		</div>
	);
}

function MapEditor({
	entries,
	label,
	disabled,
	onDraft,
	onWrite,
}: {
	readonly entries: Readonly<Record<string, unknown>>;
	readonly label: string;
	readonly disabled: boolean;
	readonly onDraft: (value: unknown) => void;
	readonly onWrite: (value: unknown) => void;
}) {
	const [newKey, setNewKey] = useState("");
	const pairs = Object.entries(entries);
	const taken = Object.hasOwn(entries, newKey.trim());
	const add = () => {
		const key = newKey.trim();
		if (key === "" || taken) return;
		onWrite({ ...entries, [key]: "" });
		setNewKey("");
	};
	return (
		<div className="ms-3 flex flex-col gap-2 border-s border-line ps-3">
			{pairs.map(([key, item]) => (
				<div key={key} className="flex items-start gap-1">
					<div className="min-w-0 flex-1">
						<p className="mb-1 font-mono text-xs text-muted">{key}</p>
						<ValueEditor
							value={item}
							label={`${label} ${key}`}
							disabled={disabled}
							onDraft={(next) => onDraft({ ...entries, [key]: next })}
							onWrite={(next) => onWrite({ ...entries, [key]: next })}
						/>
					</div>
					<button
						type="button"
						aria-label={i18n.t("forms.map.remove", { key })}
						disabled={disabled}
						onClick={() =>
							onWrite(
								Object.fromEntries(pairs.filter(([other]) => other !== key)),
							)
						}
						className={`${SMALL_BUTTON} mt-5 hover:text-danger`}
					>
						<TrashIcon />
					</button>
				</div>
			))}
			<div className="flex gap-2">
				<input
					aria-label={i18n.t("forms.any.newKeyIn", { label })}
					placeholder={i18n.t("forms.any.newKey")}
					dir="auto"
					value={newKey}
					disabled={disabled}
					onChange={(event) => setNewKey(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							add();
						}
					}}
					className={`${INPUT_CLASS} ${borderClass(taken)} min-w-0 font-mono text-[13px]`}
				/>
				<button
					type="button"
					disabled={disabled || newKey.trim() === "" || taken}
					onClick={add}
					className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-dashed border-line-strong px-3 text-xs text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
				>
					<PlusIcon className="size-3" /> {i18n.t("forms.map.add")}
				</button>
			</div>
		</div>
	);
}
