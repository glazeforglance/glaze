import { GlazeMark } from "../ui/icons.tsx";

/**
 * The "glaze" wordmark with the logo mark.
 * @returns The logo element.
 */
export function Logo() {
	return (
		<span className="flex items-center gap-2">
			<GlazeMark className="size-7" />
			<span className="text-lg font-bold tracking-tight">glaze</span>
		</span>
	);
}
