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

const SOURCES: readonly { value: IconSource; label: string; hint: string }[] = [
	{ value: "si", label: "Simple Icons", hint: "e.g. jellyfin" },
	{ value: "di", label: "Dashboard Icons", hint: "e.g. immich, or immich.png" },
	{ value: "sh", label: "selfh.st", hint: "e.g. glance" },
	{ value: "mdi", label: "Material Design", hint: "e.g. server" },
	{ value: "url", label: "Image URL", hint: "https://… or /assets/…" },
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
					aria-label={`${label}: source`}
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
							{option.label}
						</option>
					))}
				</select>
				<input
					id={id}
					ref={(element) => field.ref(element)}
					name={name}
					value={env ? text : parts.name}
					placeholder={current?.hint}
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
				Invert on light themes
			</label>
		</FieldShell>
	);
}
