import {
	type Announcements,
	type DndContextProps,
	type DragStartEvent,
	type KeyboardCoordinateGetter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
	ActiveDrag,
	DragData,
	DragIndicator,
	DragState,
} from "../components/dnd/drag-state.ts";
import {
	indicatorLine,
	type Point,
	previewPosition,
} from "../lib/dnd-geometry.ts";
import { measureLists } from "../lib/dnd-measure.ts";
import {
	type DropTarget,
	isArrowKey,
	isNoOp,
	locateWidget,
	nextKeyboardTarget,
	pointerTarget,
	toCoreIndex,
	type WidgetList,
} from "../lib/drop-target.ts";
import { useEditor } from "../store/editor-store.ts";

const IDLE: DragState = { active: null, target: null, indicator: null };

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
	return a?.listId === b?.listId && a?.index === b?.index;
}

function isDragData(value: unknown): value is DragData {
	return (
		typeof value === "object" &&
		value !== null &&
		"kind" in value &&
		(value.kind === "widget" || value.kind === "library")
	);
}

function sourceOf(active: ActiveDrag | null): DropTarget | null {
	return active?.kind === "widget" ? active.source : null;
}

/** Measures the lists and works out where to draw the indicator for `target`. */
function indicatorFor(target: DropTarget | null): DragIndicator | null {
	if (!target) return null;
	const list = measureLists().find(
		(candidate) => candidate.id === target.listId,
	);
	return list
		? { listId: list.id, ...indicatorLine(list, target.index) }
		: null;
}

function pointOf(event: Event | null): Point | null {
	return event instanceof MouseEvent
		? { x: event.clientX, y: event.clientY }
		: null;
}

/**
 * All drag & drop behaviour of the editor: sensors (pointer + keyboard),
 * the live drop target, screen reader announcements, and turning a drop into
 * a `moveWidget` / `addWidget` call on the store.
 *
 * The drop indicator is drawn over the lists, never in the layout, so nothing
 * moves while dragging. Pointer drags measure the lists on every pointer move
 * (and scroll) and pick the slot with hysteresis (`pointerTarget`); dnd-kit's
 * own droppables and collision detection aren't used. Keyboard drags track
 * the target logically with `nextKeyboardTarget` and only move the preview
 * for show. A drop always lands exactly where the indicator was.
 * @param lists - Drop targets of the open page.
 * @returns The drag state (for the indicator) and props for `<DndContext>`.
 */
export function useEditorDnd(lists: readonly WidgetList[]): {
	state: DragState;
	dndProps: DndContextProps;
} {
	const [state, setState] = useState<DragState>(IDLE);
	// dnd-kit callbacks can fire before React re-renders, so they read the latest values from refs.
	const latest = useRef<DragState>(IDLE);
	const listsRef = useRef(lists);
	const viaKeyboard = useRef(false);
	// Last announced position, so a pointer drag only announces actual changes.
	const announced = useRef<string | null>(null);
	// The pointer during a pointer drag, in viewport coordinates.
	const pointer = useRef<Point | null>(null);
	const moveWidget = useEditor((store) => store.moveWidget);
	const addWidget = useEditor((store) => store.addWidget);

	useEffect(() => {
		listsRef.current = lists;
	}, [lists]);

	const update = useCallback((next: DragState) => {
		latest.current = next;
		setState(next);
	}, []);

	/** Recomputes a pointer drag's target from the pointer and the lists as they are on screen now. */
	const refreshPointerTarget = useCallback(() => {
		const current = latest.current;
		if (!current.active || viaKeyboard.current || !pointer.current) return;
		const target = pointerTarget(
			listsRef.current,
			measureLists(),
			pointer.current,
			current.target,
		);
		if (sameTarget(target, current.target)) return;
		update({ ...current, target, indicator: indicatorFor(target) });
	}, [update]);

	const dragging = state.active !== null;
	useEffect(() => {
		if (!dragging || viaKeyboard.current) return;
		// Capture on window runs before dnd-kit's own listeners, so its
		// announcements already see the new target.
		const onMove = (event: PointerEvent) => {
			pointer.current = { x: event.clientX, y: event.clientY };
			refreshPointerTarget();
		};
		// Scrolling moves the lists under a resting pointer.
		const onScroll = () => refreshPointerTarget();
		window.addEventListener("pointermove", onMove, { capture: true });
		window.addEventListener("scroll", onScroll, { capture: true });
		refreshPointerTarget();
		return () => {
			window.removeEventListener("pointermove", onMove, { capture: true });
			window.removeEventListener("scroll", onScroll, { capture: true });
		};
	}, [dragging, refreshPointerTarget]);

	/** Describes a drop target by the position the widget will *end up* at. */
	const describe = (target: DropTarget | null, active: ActiveDrag | null) => {
		const list = target
			? listsRef.current.find((candidate) => candidate.id === target.listId)
			: undefined;
		if (!target || !list) return "no drop area";
		return `${list.label}, position ${toCoreIndex(sourceOf(active), target) + 1}`;
	};

	const keyboardStep = useCallback<KeyboardCoordinateGetter>(
		(event, { context }) => {
			if (!isArrowKey(event.code)) return undefined;
			event.preventDefault();
			const current = latest.current;
			if (!current.active) return undefined;
			const next = nextKeyboardTarget(
				listsRef.current,
				current.target,
				sourceOf(current.active),
				event.code,
			);
			if (!next) return undefined;
			const indicator = indicatorFor(next);
			update({ ...current, target: next, indicator });
			// Move the preview onto the indicator (only visual).
			const list = measureLists().find((c) => c.id === next.listId);
			if (!list || !indicator || !context.collisionRect) return undefined;
			return previewPosition(list, indicator, context.collisionRect);
		},
		[update],
	);

	const sensors = useSensors(
		// A few pixels of movement before a drag starts, so clicks stay clicks.
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: keyboardStep }),
	);

	const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
		const data = active.data.current;
		if (!isDragData(data)) return;
		viaKeyboard.current = activatorEvent instanceof KeyboardEvent;
		announced.current = null;
		pointer.current = pointOf(activatorEvent);
		if (data.kind === "library") {
			update({ active: data, target: null, indicator: null });
			return;
		}
		const source = locateWidget(lists, data.widgetId);
		if (!source) return;
		// A keyboard drag starts "on" the widget itself, so the first arrow press moves from there.
		const target = viaKeyboard.current ? source : null;
		update({
			active: { ...data, source },
			target,
			indicator: indicatorFor(target),
		});
	};

	const onDragEnd = () => {
		const { active, target } = latest.current;
		announced.current = target ? describe(target, active) : null;
		const list = target
			? lists.find((candidate) => candidate.id === target.listId)
			: undefined;
		// The edit runs before the drag state is cleared; dnd-kit batches both
		// into one render, so the widget never shows in its old place.
		if (active && target && list) {
			if (active.kind === "library") {
				addWidget(
					{ type: active.type, title: active.label },
					list.path,
					target.index,
				);
			} else if (!isNoOp(active.source, target)) {
				moveWidget(
					active.widgetId,
					list.path,
					toCoreIndex(active.source, target),
				);
			}
		}
		update(IDLE);
	};

	const labelOf = (data: unknown): string =>
		isDragData(data) ? data.label : "widget";

	const announcements: Announcements = {
		onDragStart: ({ active }) => `Picked up ${labelOf(active.data.current)}.`,
		// Announce from our own drop position (not dnd-kit's "over"), and only when it changes.
		onDragMove: ({ active }) => {
			const { target } = latest.current;
			if (!target) return undefined;
			const where = describe(target, latest.current.active);
			if (where === announced.current) return undefined;
			announced.current = where;
			return `${labelOf(active.data.current)} will be placed in ${where}.`;
		},
		onDragOver: () => undefined,
		onDragEnd: ({ active }) =>
			announced.current
				? `${labelOf(active.data.current)} was dropped in ${announced.current}.`
				: `${labelOf(active.data.current)} was dropped outside a drop area.`,
		onDragCancel: ({ active }) =>
			`Moving ${labelOf(active.data.current)} was cancelled.`,
	};

	return {
		state,
		dndProps: {
			sensors,
			onDragStart,
			onDragEnd,
			onDragCancel: () => update(IDLE),
			accessibility: {
				announcements,
				screenReaderInstructions: {
					draggable:
						"To pick up a widget, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, and Escape to cancel.",
				},
			},
		},
	};
}
