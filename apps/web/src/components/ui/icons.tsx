// Small inline SVG icons (no icon library). All are decorative: buttons that
// only show an icon carry their own aria-label.

interface IconProps {
	readonly className?: string;
}

const STROKE = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.8,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const;

/** The Glaze logo mark: an eye in a rounded square, like a glance. */
export function GlazeMark({ className = "size-7" }: IconProps) {
	return (
		<svg viewBox="0 0 28 28" className={className} aria-hidden="true">
			<rect
				x="1"
				y="1"
				width="26"
				height="26"
				rx="8"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			/>
			<path d="M7 15c2-4 4.5-6 7-6s5 2 7 6" {...STROKE} strokeWidth={2} />
			<circle cx="14" cy="15" r="2.6" fill="currentColor" />
		</svg>
	);
}

/** Six dots: the drag handle. */
export function GripIcon({ className = "size-3.5" }: IconProps) {
	return (
		<svg viewBox="0 0 12 16" className={className} aria-hidden="true">
			{[3, 8, 13].flatMap((y) =>
				[3.5, 8.5].map((x) => (
					<circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" />
				)),
			)}
		</svg>
	);
}

export function PlusIcon({ className = "size-3.5" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<path d="M8 3v10M3 8h10" {...STROKE} />
		</svg>
	);
}

export function UndoIcon({ className = "size-4" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<path d="M6 4 3 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H7" {...STROKE} />
		</svg>
	);
}

export function ChevronDownIcon({ className = "size-3" }: IconProps) {
	return (
		<svg viewBox="0 0 12 12" className={className} aria-hidden="true">
			<path d="m3 4.5 3 3 3-3" {...STROKE} />
		</svg>
	);
}

export function SearchIcon({ className = "size-4" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<circle cx="7" cy="7" r="4.5" {...STROKE} />
			<path d="m10.5 10.5 3 3" {...STROKE} />
		</svg>
	);
}
