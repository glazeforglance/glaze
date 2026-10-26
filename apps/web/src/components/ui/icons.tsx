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

/**
 * The Glaze logo: a Glance column plus widgets, with the edited one in amber.
 * Same artwork as `docs/brand/glaze-logo.svg`; its colors are fixed on purpose
 * so the logo looks identical everywhere, independent of `currentColor`.
 */
export function GlazeMark({ className = "size-7" }: IconProps) {
	return (
		<svg
			viewBox="0 0 64 64"
			fill="none"
			className={className}
			aria-hidden="true"
		>
			<rect width="64" height="64" rx="14" fill="#151519" />
			<rect
				x="10"
				y="14"
				width="16"
				height="36"
				rx="4"
				fill="#1F1F28"
				stroke="#232832"
				strokeWidth="2"
			/>
			<line
				x1="14"
				y1="19"
				x2="22"
				y2="19"
				stroke="#6CB6FF"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
			<rect
				x="30"
				y="37"
				width="24"
				height="13"
				rx="4"
				fill="#1F1F28"
				stroke="#D9C38C"
				strokeWidth="2"
				strokeOpacity="0.5"
			/>
			<rect
				x="30"
				y="12"
				width="24"
				height="21"
				rx="4.5"
				fill="#1F1F28"
				stroke="#F5B54A"
				strokeWidth="3"
			/>
			<circle cx="36" cy="19" r="2.2" fill="#5BD08F" />
			<line
				x1="41"
				y1="19"
				x2="49"
				y2="19"
				stroke="#E6E8EC"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<circle cx="36" cy="26" r="2.2" fill="#5BD08F" />
			<line
				x1="41"
				y1="26"
				x2="47"
				y2="26"
				stroke="#A3ABB8"
				strokeWidth="2"
				strokeLinecap="round"
			/>
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

export function CopyIcon({ className = "size-3.5" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<rect x="5" y="5" width="8.5" height="8.5" rx="1.8" {...STROKE} />
			<path
				d="M10.5 5V3.8A1.8 1.8 0 0 0 8.7 2H3.8A1.8 1.8 0 0 0 2 3.8v4.9a1.8 1.8 0 0 0 1.8 1.8H5"
				{...STROKE}
			/>
		</svg>
	);
}

export function TrashIcon({ className = "size-3.5" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<path
				d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2c.1.8.7 1.3 1.5 1.3h2.8c.8 0 1.4-.5 1.5-1.3l.6-8.2"
				{...STROKE}
			/>
		</svg>
	);
}

export function MoreIcon({ className = "size-4" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			{[3.5, 8, 12.5].map((x) => (
				<circle key={x} cx={x} cy="8" r="1.3" fill="currentColor" />
			))}
		</svg>
	);
}

export function CheckIcon({ className = "size-3.5" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<path d="m3.5 8.5 3 3 6-7" {...STROKE} />
		</svg>
	);
}

/** A desktop screen: the desktop preview. */
export function DesktopIcon({ className = "size-4" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<rect x="2" y="3" width="12" height="8" rx="1.5" {...STROKE} />
			<path d="M6 14h4M8 11v3" {...STROKE} />
		</svg>
	);
}

/** A phone: the phone preview. */
export function PhoneIcon({ className = "size-4" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<rect x="4.5" y="1.5" width="7" height="13" rx="1.5" {...STROKE} />
			<path d="M7.2 12.2h1.6" {...STROKE} />
		</svg>
	);
}

/** Circular arrow: reload. */
export function ReloadIcon({ className = "size-4" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3" {...STROKE} />
		</svg>
	);
}

/** Two panes side by side: show or hide the preview next to the code. */
export function SplitIcon({ className = "size-4" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<rect x="2" y="3" width="12" height="10" rx="1.5" {...STROKE} />
			<path d="M9 3v10" {...STROKE} />
		</svg>
	);
}

/** A person: the user menu. */
export function UserIcon({ className = "size-4" }: IconProps) {
	return (
		<svg viewBox="0 0 16 16" className={className} aria-hidden="true">
			<circle cx="8" cy="5.5" r="2.75" {...STROKE} />
			<path
				d="M2.75 13.5c.9-2.4 2.9-3.75 5.25-3.75s4.35 1.35 5.25 3.75"
				{...STROKE}
			/>
		</svg>
	);
}
