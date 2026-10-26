import { type KeyboardEvent, useId, useRef } from "react";
import { sameValue } from "../paths.ts";
import { useWidgetField } from "../use-widget-form.ts";
import { describedBy } from "./field-styles.ts";
import { FieldShell } from "./FieldShell.tsx";

/** One segment. */
export interface Segment {
	readonly value: string | number | boolean;
	readonly label: string;
}

export interface SegmentedFieldProps {
	readonly name: string;
	readonly label: string;
	readonly segments: readonly Segment[];
	/** Glance's default; shown as selected while the key isn't set, and not written. */
	readonly glanceDefault?: Segment["value"];
	readonly hint?: string;
}

/**
 * A row of mutually exclusive buttons (the mock's Standaard / Compact).
 * Works like a radio group: arrow keys move the choice and write it.
 * @param props - Field name, label and segments.
 * @returns The field element.
 */
export function SegmentedField({
	name,
	label,
	segments,
	glanceDefault,
	hint,
}: SegmentedFieldProps) {
	const id = useId();
	const widgetField = useWidgetField(name, { glanceDefault });
	const { field, error, disabled } = widgetField;
	const buttons = useRef<(HTMLButtonElement | null)[]>([]);
	const current = field.value === undefined ? glanceDefault : field.value;
	const selectedIndex = segments.findIndex((segment) =>
		sameValue(segment.value, current),
	);

	const choose = (index: number) => {
		const segment = segments[index];
		if (!segment || disabled) return;
		field.onChange(segment.value);
		widgetField.commit(segment.value);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step =
			event.key === "ArrowRight" || event.key === "ArrowDown"
				? 1
				: event.key === "ArrowLeft" || event.key === "ArrowUp"
					? -1
					: 0;
		if (step === 0) return;
		event.preventDefault();
		const next =
			(Math.max(selectedIndex, 0) + step + segments.length) % segments.length;
		choose(next);
		buttons.current[next]?.focus();
	};

	return (
		<FieldShell
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
				role="radiogroup"
				aria-labelledby={`${id}-label`}
				aria-describedby={describedBy(id, error)}
				onKeyDown={onKeyDown}
				className="grid gap-2"
				style={{
					gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))`,
				}}
			>
				{segments.map((segment, index) => {
					const selected = index === selectedIndex;
					// Roving tab stop: only the chosen segment (or the first) is in the tab order.
					const tabbable = selected || (selectedIndex === -1 && index === 0);
					return (
						<button
							key={String(segment.value)}
							ref={(element) => {
								buttons.current[index] = element;
								if (index === 0) field.ref(element);
							}}
							type="button"
							role="radio"
							aria-checked={selected}
							tabIndex={tabbable ? 0 : -1}
							disabled={disabled}
							onClick={() => choose(index)}
							className={`min-h-10 cursor-pointer rounded-sm border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
								selected
									? "border-accent bg-accent/8 font-semibold text-accent"
									: "border-line bg-card text-muted hover:border-line-strong hover:text-text"
							}`}
						>
							{segment.label}
						</button>
					);
				})}
			</div>
		</FieldShell>
	);
}
