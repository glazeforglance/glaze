import { useId, useState } from "react";
import { isEnvReference } from "../schema.ts";
import { useWidgetField } from "../use-widget-form.ts";
import {
	formatIcon,
	type IconParts,
	type IconSource,
	parseIcon,
} from "../values.ts";
import {
	borderClass,
	describedBy,
	displayText,
	INPUT_CLASS,
} from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";
import { useTranslation } from "react-i18next";

const SOURCES: readonly { value: IconSource; label: string; hint: string }[] = [
	{ value: "si", label: "Simple Icons", hint: "jellyfin" },
	{ value: "di", label: "Dashboard Icons", hint: "immich, immich.png" },
	{ value: "sh", label: "selfh.st", hint: "glance" },
	{ value: "mdi", label: "Material Design", hint: "server" },
	{ value: "url", label: "", hint: "https://…, /assets/…" },
];

export interface IconFieldProps {
	readonly name: string;
	readonly label: string;
	readonly hint?: string;
}

/**
 * A Glance icon: pick the source (Simple Icons, Dashboard Icons, selfh.st,
 * Material Design or a URL), type the name, and optionally invert it on
 * light themes. Writes `si:name`, `auto-invert di:name` or the URL.
 * @param props - Field name and label.
 * @returns The field element.
 */
export function IconField({ name, label, hint }: IconFieldProps) {
	const { t } = useTranslation();
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	const text = displayText(field.value);
	const parsed = parseIcon(text);
	// The source picked for an empty field, before anything is typed.
	const [source, setSource] = useState<IconSource>(parsed.source);
	const parts: IconParts = text === "" ? { ...parsed, source } : parsed;
	const env = isEnvReference(text);
	const current = SOURCES.find((candidate) => candidate.value === parts.source);

	const write = (next: IconParts) => {
		const value = formatIcon(next);
		field.onChange(value);
		widgetField.commit(value);
	};

	return (
		<FieldShell
			name={name}
			inputId={id}
			label={label}
			status={widgetField.status}
			env={widgetField.env}
			error={error}
			hint={hint}
			readOnly={widgetField.readOnly}
			onOverride={widgetField.override}
		>
			<div className="flex gap-2">
				<select
					aria-label={t("forms.icon.source", { label })}
					value={parts.source}
					disabled={disabled || env}
					onChange={(event) => {
						const next = event.target.value as IconSource;
						setSource(next);
						if (parts.name !== "") write({ ...parts, source: next });
					}}
					className={`${INPUT_CLASS} ${borderClass(false)} w-40 shrink-0 cursor-pointer`}
				>
					{SOURCES.map((option) => (
						<option key={option.value} value={option.value}>
							{/* Icon set names are brands; only "Image URL" is ours. */}
							{option.label || t("forms.icon.imageUrl")}
						</option>
					))}
				</select>
				<input
					id={id}
					ref={(element) => field.ref(element)}
					name={name}
					value={env ? text : parts.name}
					placeholder={
						current
							? t("forms.icon.example", { example: current.hint })
							: undefined
					}
					dir="ltr"
					disabled={disabled}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy(id, error)}
					onChange={(event) =>
						field.onChange(
							env
								? event.target.value
								: formatIcon({ ...parts, name: event.target.value }) || "",
						)
					}
					onBlur={() => widgetField.commit(field.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							widgetField.commit(field.value);
						} else if (event.key === "Escape") {
							event.preventDefault();
							widgetField.cancel();
						}
					}}
					className={`${INPUT_CLASS} ${borderClass(error !== undefined)} min-w-0 font-mono text-[13px]`}
				/>
			</div>
			<label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted">
				<input
					type="checkbox"
					checked={parts.autoInvert}
					disabled={disabled || env || parts.name === ""}
					onChange={(event) =>
						write({ ...parts, autoInvert: event.target.checked })
					}
					className="size-4 cursor-pointer accent-[var(--color-accent)]"
				/>
				{t("forms.icon.invert")}
			</label>
		</FieldShell>
	);
}
