import type { EnvReference } from "@glaze/core";
import type { ReactNode } from "react";
import type { FieldStatus } from "../use-widget-form.ts";
import { EnvChip } from "./EnvChip.tsx";

export interface FieldShellProps {
	/** Id of the input, so the label points at it. */
	readonly inputId: string;
	readonly label: string;
	/** Labels a group of controls (segmented, list) instead of one input. */
	readonly asGroup?: boolean;
	readonly status: FieldStatus;
	readonly env?: readonly EnvReference[];
	readonly error?: string;
	readonly hint?: ReactNode;
	/** Extra text on the right of the label, e.g. the number of list items. */
	readonly aside?: ReactNode;
	readonly readOnly: boolean;
	readonly onOverride: () => void;
	readonly children: ReactNode;
}

/**
 * Label, badges, hint and error around one form control, styled like the
 * mock (small upper-case mono labels).
 * @param props - Field state and the control itself.
 * @returns The field element.
 */
export function FieldShell({
	inputId,
	label,
	asGroup = false,
	status,
	env = [],
	error,
	hint,
	aside,
	readOnly,
	onOverride,
	children,
}: FieldShellProps) {
	const labelClass =
		"font-mono text-[11px] font-semibold uppercase tracking-wider text-muted";
	return (
		<div className="mb-4">
			<div className="mb-1.5 flex min-h-5 items-center gap-2">
				{asGroup ? (
					<span id={`${inputId}-label`} className={labelClass}>
						{label}
					</span>
				) : (
					<label htmlFor={inputId} className={labelClass}>
						{label}
					</label>
				)}
				{env.map((reference) => (
					<EnvChip key={reference.raw} reference={reference} />
				))}
				{status === "inherited" && (
					<span
						title="Comes from a YAML merge key (<<: *anchor)"
						className="rounded-[6px] bg-violet/12 px-1.5 py-0.5 font-mono text-[10px] text-violet"
					>
						inherited
					</span>
				)}
				<span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-faint">
					{aside}
					{status === "inherited" && !readOnly && (
						<button
							type="button"
							onClick={onOverride}
							className="cursor-pointer rounded-[6px] px-1.5 py-0.5 text-accent hover:bg-accent/10"
						>
							Override
						</button>
					)}
				</span>
			</div>
			{children}
			<p
				id={`${inputId}-hint`}
				className="mt-1 text-xs text-faint empty:hidden"
			>
				{hint}
			</p>
			{error && (
				<p
					id={`${inputId}-error`}
					role="alert"
					className="mt-1 text-xs text-danger"
				>
					{error}
				</p>
			)}
		</div>
	);
}
