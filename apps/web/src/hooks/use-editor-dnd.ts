import {
	type Announcements,
	type DndContextProps,
	type DragEndEvent,
	type DragMoveEvent,
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
	DragState,
	DropData,
} from "../components/dnd/drag-state.ts";
import {
	coordinatesBefore,
	editorCollision,
	endDropId,
	INDICATOR_DROP_ID,
	toOverItem,
} from "../lib/dnd-geometry.ts";
import {
	type DropTarget,
	isArrowKey,
	isHeadList,
	isNoOp,
	locateWidget,
	nextKeyboardTarget,
	targetFromOver,
	toCoreIndex,
	type WidgetList,
} from "../lib/drop-target.ts";
import { useEditor } from "../store/editor-store.ts";

const IDLE: DragState = { active: null, target: null };

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

function axisOf(value: unknown): DropData["axis"] {
	return typeof value === "object" &&
		value !== null &&
		"axis" in value &&
		value.axis === "x"
		? "x"
		: "y";
}

function sourceOf(active: ActiveDrag | null): DropTarget | null {
	return active?.kind === "widget" ? active.source : null;
}

/**
 * All drag & drop behaviour of the editor: sensors (pointer + keyboard),
 * the live drop target, screen reader announcements, and turning a drop into
 * a `moveWidget` / `addWidget` call on the store.
 *
 * Pointer drags find their target from what is under the pointer. Keyboard
 * drags track it logically with `nextKeyboardTarget`; their preview is only
 * moved for show, because the drop indicator shifts widgets around and
 * geometry would then point at the wrong spot.
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
	const moveWidget = useEditor((store) => store.moveWidget);
	const addWidget = useEditor((store) => store.addWidget);

	useEffect(() => {
		listsRef.current = lists;
	}, [lists]);

	const update = useCallback((next: DragState) => {
		latest.current = next;
		setState(next);
	}, []);

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
			update({ ...current, target: next });
			// Move the preview next to the new position (only visual).
			const list = listsRef.current.find((c) => c.id === next.listId);
			if (!list || !context.collisionRect) return undefined;
			const dropId = list.widgetIds[next.index] ?? endDropId(list.id);
			const rect = context.droppableRects.get(dropId);
			if (!rect) return undefined;
			return coordinatesBefore(
				rect,
				context.collisionRect,
				isHeadList(list) ? "x" : "y",
			);
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
		if (data.kind === "library") {
			update({ active: data, target: null });
			return;
		}
		const source = locateWidget(lists, data.widgetId);
		if (!source) return;
		// A keyboard drag starts "on" the widget itself, so the first arrow press moves from there.
		update({
			active: { ...data, source },
			target: viaKeyboard.current ? source : null,
		});
	};

	const pointerTarget = ({
		active,
		over,
	}: DragMoveEvent | DragEndEvent): DropTarget | null => {
		if (!over) return null;
		// Over the indicator itself: it pushed the widgets away, keep the position it shows.
		if (over.id === INDICATOR_DROP_ID) return latest.current.target;
		return targetFromOver(
			lists,
			toOverItem(
				over.id,
				over.rect,
				active.rect.current.translated,
				axisOf(over.data.current),
			),
		);
	};

	const onDragMove = (event: DragMoveEvent) => {
		const current = latest.current;
		if (!current.active || viaKeyboard.current) return;
		const target = pointerTarget(event);
		if (!sameTarget(target, current.target)) update({ ...current, target });
	};

	const onDragEnd = (event: DragEndEvent) => {
		const { active } = latest.current;
		// A pointer drop is recomputed from the drop event: the last move may not be processed yet.
		const target = viaKeyboard.current
			? latest.current.target
			: pointerTarget(event);
		announced.current = target ? describe(target, active) : null;
		update(IDLE);
		if (!active || !target) return;
		const list = lists.find((candidate) => candidate.id === target.listId);
		if (!list) return;
		if (active.kind === "library") {
			addWidget(
				{ type: active.type, title: active.label },
				list.path,
				target.index,
			);
			return;
		}
		if (isNoOp(active.source, target)) return;
		moveWidget(active.widgetId, list.path, toCoreIndex(active.source, target));
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
			collisionDetection: editorCollision,
			onDragStart,
			onDragMove,
			onDragOver: onDragMove,
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
