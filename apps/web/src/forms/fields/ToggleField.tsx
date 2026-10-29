import { useId } from "react";
import { CheckIcon } from "../../components/ui/icons.tsx";
import { useWidgetField } from "../use-widget-form.ts";
import { describedBy } from "./field-styles.ts";
import { useTranslation } from "react-i18next";
import { OptionKey } from "./OptionKey.tsx";

export interface ToggleFieldProps {
	readonly name: string;
	readonly label: string;
	readonly hint?: string;
	/** Glance's default; not written while the key isn't in the file. */
	readonly glanceDefault?: boolean;
}

/**
 * A checkbox for a yes/no option (the mock's "Alleen storingen tonen").
 * Writes as soon as it's clicked.
 * @param props - Field name, label and Glance's default.
 * @returns The field element.
 */
export function ToggleField({
	name,
	label,
	hint,
	glanceDefault = false,
}: ToggleFieldProps) {
	const { t } = useTranslation();
	const id = useId();
	const widgetField = useWidgetField(name, { glanceDefault });
	const { field, error, disabled, status } = widgetField;
	const checked =
		typeof field.value === "boolean" ? field.value : glanceDefault;

	return (
		<div className="mb-4">
			<div className="flex min-h-10 items-center gap-3">
				<span className="relative inline-flex size-5 shrink-0">
					<input
						id={id}
						ref={(element) => field.ref(element)}
						name={name}
						type="checkbox"
						checked={checked}
						disabled={disabled}
						aria-describedby={describedBy(id, error)}
						onChange={(event) => {
							field.onChange(event.target.checked);
							widgetField.commit(event.target.checked);
						}}
						onBlur={field.onBlur}
						className="peer size-5 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-card transition-colors checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
					/>
					<CheckIcon className="pointer-events-none absolute inset-0.5 hidden size-4 text-accent-ink peer-checked:block" />
				</span>
				<label htmlFor={id} className="cursor-pointer text-sm">
					{label}
				</label>
				<OptionKey name={name} />
				{status === "inherited" && (
					<span className="rounded-[6px] bg-violet/12 px-1.5 py-0.5 font-mono text-[10px] text-violet">
						{t("forms.inherited")}
					</span>
				)}
				{status === "inherited" && !widgetField.readOnly && (
					<button
						type="button"
						onClick={widgetField.override}
						className="ms-auto cursor-pointer rounded-[6px] px-1.5 py-0.5 font-mono text-[11px] text-accent hover:bg-accent/10"
					>
						{t("forms.override")}
					</button>
				)}
			</div>
			<p id={`${id}-hint`} className="mt-1 text-xs text-faint empty:hidden">
				{hint}
			</p>
			{error && (
				<p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
					{error}
				</p>
			)}
		</div>
	);
}
