import { useState } from "react";
import {
	clampSize,
	type PanelState,
	parsePanelState,
	type ResizeBounds,
} from "../lib/resize.ts";

/** Default size and limits of a side panel. */
export interface PanelConfig extends ResizeBounds {
	readonly defaultWidth: number;
}

/** A side panel's state and the ways to change it. */
export interface Panel extends PanelState, PanelConfig {
	setWidth(width: number): void;
	/** Puts the width back to its default (double-click on the handle). */
	resetWidth(): void;
	setCollapsed(collapsed: boolean): void;
}

const keyFor = (id: string) => `glaze:panel:${id}`;

// Only a per-viewer convenience; storage can be blocked, so never rely on it.
function readPanel(id: string, config: PanelConfig): PanelState {
	const defaults = { width: config.defaultWidth, collapsed: false };
	try {
		return parsePanelState(localStorage.getItem(keyFor(id)), defaults, config);
	} catch {
		return defaults;
	}
}

function writePanel(id: string, state: PanelState): void {
	try {
		localStorage.setItem(keyFor(id), JSON.stringify(state));
	} catch {
		// Not remembered; that's fine.
	}
}

/**
 * The width and collapsed state of a side panel, remembered per browser.
 * @param id - Storage name, e.g. `library`.
 * @param config - Default width and limits, in px.
 * @returns The panel's state and setters.
 */
export function usePanel(id: string, config: PanelConfig): Panel {
	const [state, setState] = useState(() => readPanel(id, config));
	const update = (change: Partial<PanelState>) => {
		const next = { ...state, ...change };
		setState(next);
		writePanel(id, next);
	};
	return {
		...config,
		...state,
		setWidth: (width) => update({ width: clampSize(width, config) }),
		resetWidth: () => update({ width: config.defaultWidth }),
		setCollapsed: (collapsed) => update({ collapsed }),
	};
}
