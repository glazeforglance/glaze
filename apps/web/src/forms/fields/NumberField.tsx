import { toNumber } from "../convert.ts";
import { TextField } from "./TextField.tsx";

export interface NumberFieldProps {
	readonly name: string;
	readonly label: string;
	readonly placeholder?: string;
	readonly hint?: string;
}

/**
 * A number input. It is a text input underneath, so `${VAR}` still works and
 * the schema (not the browser) decides what is valid.
 * @param props - Field name, label and options.
 * @returns The field element.
 */
export function NumberField(props: NumberFieldProps) {
	return <TextField {...props} mono inputMode="numeric" parse={toNumber} />;
}
