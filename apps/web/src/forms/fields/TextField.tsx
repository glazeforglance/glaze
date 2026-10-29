import { useId, useState } from "react";
import { isEnvReference } from "../schema.ts";
import { useWidgetField } from "../use-widget-form.ts";
import { borderClass, describedBy, INPUT_CLASS } from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";
import { useTextInput } from "./use-text-input.ts";
import { useTranslation } from "react-i18next";

export interface TextFieldProps {
	/** Field name, e.g. `title` or `sites.2.url`. */
	readonly name: string;
	readonly label: string;
	readonly placeholder?: string;
	readonly hint?: string;
	/** Shows the value in the mono font (URLs, ids, CSS classes). */
	readonly mono?: boolean;
	/** API keys and tokens: hidden like a password, with a tip to use `${ENV_VAR}`. */
	readonly secret?: boolean;
	/**
	 * Turns the text into the value to write, e.g. a number. Runs before
	 * validation, so the schema sees the converted value.
	 */
	readonly parse?: (text: string) => unknown;
	/** Turns the document's value into text, e.g. `[401, 403]` → `401, 403`. */
	readonly format?: (value: unknown) => string;
	readonly inputMode?: "text" | "numeric" | "decimal" | "url";
}

/**
 * A one-line text input. Writes on blur or Enter (not on every keystroke), so
 * a change is one small edit; Escape drops an unsaved change.
 * @param props - Field name, label and options.
 * @returns The field element.
 */
export function TextField({
	name,
	label,
	placeholder,
	hint,
	mono = false,
	secret = false,
	parse,
	format,
	inputMode = "text",
}: TextFieldProps) {
	const { t } = useTranslation();
	const id = useId();
	const widgetField = useWidgetField(name);
	const { field, error, disabled } = widgetField;
	const input = useTextInput(widgetField, parse, format);
	const [revealed, setRevealed] = useState(false);
	const isEnv = isEnvReference(input.value);
	const hidden = secret && !revealed && !isEnv;

	return (
		<FieldShell
			name={name}
			inputId={id}
			label={label}
			status={widgetField.status}
			env={widgetField.env}
			error={error}
			hint={
				hint ??
				(secret && !isEnv
					? t("forms.secretTip", { env: "${YOUR_VAR}" })
					: undefined)
			}
			readOnly={widgetField.readOnly}
			onOverride={widgetField.override}
		>
			<div className="relative">
				<input
					{...input}
					id={id}
					ref={(element) => field.ref(element)}
					name={name}
					type={hidden ? "password" : "text"}
					inputMode={inputMode}
					placeholder={placeholder}
					disabled={disabled}
					autoComplete="off"
					spellCheck={false}
					// Addresses, keys and ${VAR}s read left to right; free text follows its content.
					dir={mono || isEnv || inputMode === "url" ? "ltr" : "auto"}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy(id, error)}
					className={`${INPUT_CLASS} ${borderClass(error !== undefined)} ${
						mono || isEnv ? "font-mono text-[13px]" : ""
					} ${secret && !isEnv ? "pe-16" : ""}`}
				/>
				{secret && !isEnv && (
					<button
						type="button"
						onClick={() => setRevealed((value) => !value)}
						aria-pressed={revealed}
						aria-label={
							revealed
								? t("forms.hideValue", { label })
								: t("forms.showValue", { label })
						}
						className="absolute top-1/2 end-1.5 min-h-7 -translate-y-1/2 cursor-pointer rounded-[6px] px-2 font-mono text-[11px] text-muted hover:bg-card-hover hover:text-text"
					>
						{revealed ? t("forms.hide") : t("forms.show")}
					</button>
				)}
			</div>
		</FieldShell>
	);
}
