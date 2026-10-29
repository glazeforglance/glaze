import type { EnvReference } from "@glaze/core";
import { useTranslation } from "react-i18next";

export interface EnvChipProps {
	readonly reference: EnvReference;
}

const PREFIX: Record<EnvReference["kind"], string> = {
	env: "ENV",
	secret: "SECRET",
	readFileFromEnv: "FILE",
};

/**
 * Marks a value that Glance fills in from a variable, e.g. `ENV GITHUB_TOKEN`.
 * Glaze never resolves the variable; it only shows its name.
 * @param props - The reference found in the value.
 * @returns The chip element.
 */
export function EnvChip({ reference }: EnvChipProps) {
	const { t } = useTranslation();
	return (
		<span
			dir="ltr"
			title={t("forms.envTitle", { reference: reference.raw })}
			className="inline-flex items-center gap-1 rounded-[6px] bg-success/12 px-1.5 py-0.5 font-mono text-[10px] text-success"
		>
			<span className="font-bold">{PREFIX[reference.kind]}</span>
			<span>{reference.name}</span>
		</span>
	);
}
