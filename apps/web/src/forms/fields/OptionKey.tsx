import { optionKeyOf } from "../paths.ts";

/**
 * A Glance option name (YAML key), shown small next to a translated label.
 * Never translated and always left to right, so it matches Glance's docs.
 * @param props - The form name the key is taken from.
 * @returns The key, or nothing.
 */
export function OptionKey({ name }: { readonly name: string | undefined }) {
	const key = optionKeyOf(name);
	if (key === null) return null;
	return (
		<code
			dir="ltr"
			className="font-mono text-[10px] font-normal tracking-normal text-faint normal-case"
		>
			{key}
		</code>
	);
}
