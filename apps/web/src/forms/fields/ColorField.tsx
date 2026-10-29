import { useId, useState } from "react";
import { formatHsl, hexToHsl, hslToHex, parseHsl } from "../../lib/color.ts";
import { useWidgetField } from "../use-widget-form.ts";
import {
	borderClass,
	describedBy,
	displayText,
	INPUT_CLASS,
} from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";
import { useTranslation } from "react-i18next";

export interface ColorFieldProps {
	readonly name: string;
	readonly label: string;
	readonly placeholder?: string;
	readonly hint?: string;
}

/**
 * A Glance HSL color (`240 13 14`): a swatch with the browser's color picker,
 * the HSL text, and a hex input. Every input writes Glance's `h s l` form.
 * @param props - Field name and label.
 * @returns The field element.
 */
export function ColorField({
	name,
	label,
	placeholder,
	hint,
}: ColorFieldProps) {
	const { t } = useTranslation();
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	const text = displayText(field.value);
	const hsl = parseHsl(text);
	const hex = hsl ? hslToHex(hsl) : "";
	// The hex text while typing; null shows the color's own hex.
	const [hexDraft, setHexDraft] = useState<string | null>(null);

	const write = (value: string) => {
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
				<input
					type="color"
					aria-label={t("forms.color.pick", { label })}
					value={hex || "#000000"}
					disabled={disabled}
					onChange={(event) => {
						const picked = hexToHsl(event.target.value);
						if (picked) field.onChange(formatHsl(picked));
					}}
					// The picker fires on every move; write once it closes.
					onBlur={() => widgetField.commit(field.value)}
					className="h-10 w-12 shrink-0 cursor-pointer rounded-sm border border-line bg-card p-1 disabled:cursor-not-allowed"
				/>
				<input
					id={id}
					ref={(element) => field.ref(element)}
					name={name}
					value={text}
					placeholder={placeholder ?? t("forms.color.placeholder")}
					dir="ltr"
					disabled={disabled}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy(id, error)}
					onChange={(event) => field.onChange(event.target.value)}
					onBlur={() => widgetField.commit(text.trim())}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							widgetField.commit(text.trim());
						} else if (event.key === "Escape") {
							event.preventDefault();
							widgetField.cancel();
						}
					}}
					className={`${INPUT_CLASS} ${borderClass(error !== undefined)} min-w-0 font-mono text-[13px]`}
				/>
				<input
					aria-label={t("forms.color.hex", { label })}
					dir="ltr"
					value={hexDraft ?? hex}
					placeholder="#rrggbb"
					disabled={disabled}
					autoComplete="off"
					spellCheck={false}
					onChange={(event) => setHexDraft(event.target.value)}
					onBlur={() => {
						const converted = hexDraft === null ? null : hexToHsl(hexDraft);
						setHexDraft(null);
						if (converted) write(formatHsl(converted));
					}}
					onKeyDown={(event) => {
						if (event.key === "Enter") event.currentTarget.blur();
						if (event.key === "Escape") setHexDraft(null);
					}}
					className={`${INPUT_CLASS} ${borderClass(false)} w-28 shrink-0 font-mono text-[13px]`}
				/>
			</div>
		</FieldShell>
	);
}
