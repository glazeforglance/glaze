import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleShortcut } from "../src/hooks/use-shortcuts.ts";
import { editorStore } from "../src/store/editor-store.ts";

// The tests run in Node: a minimal stand-in for a keydown event and `document`.
function key(init: Partial<KeyboardEvent>): KeyboardEvent {
	return {
		key: "",
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		preventDefault: vi.fn(),
		...init,
	} as unknown as KeyboardEvent;
}

let dialogOpen = false;

beforeEach(() => {
	dialogOpen = false;
	vi.stubGlobal("document", {
		querySelector: (selector: string) =>
			selector === "dialog[open]" && dialogOpen ? {} : null,
	});
	editorStore.getState().setView("design");
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("handleShortcut", () => {
	it("switches views with Ctrl or Cmd + 1/2/3", () => {
		const event = key({ key: "2", ctrlKey: true });
		expect(handleShortcut(event)).toBe(true);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(editorStore.getState().view).toBe("code");
		handleShortcut(key({ key: "3", metaKey: true }));
		expect(editorStore.getState().view).toBe("preview");
		handleShortcut(key({ key: "4", ctrlKey: true }));
		expect(editorStore.getState().view).toBe("settings");
		handleShortcut(key({ key: "1", ctrlKey: true }));
		expect(editorStore.getState().view).toBe("design");
	});

	it("asks for the publish review with Ctrl/Cmd + S", () => {
		const before = editorStore.getState().publishRequest;
		const event = key({ key: "s", metaKey: true });
		expect(handleShortcut(event)).toBe(true);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(editorStore.getState().publishRequest).toBe(before + 1);
	});

	it("ignores other keys, extra modifiers and keys while a dialog is open", () => {
		expect(handleShortcut(key({ key: "2" }))).toBe(false);
		expect(handleShortcut(key({ key: "5", ctrlKey: true }))).toBe(false);
		expect(
			handleShortcut(key({ key: "s", ctrlKey: true, shiftKey: true })),
		).toBe(false);
		dialogOpen = true;
		expect(handleShortcut(key({ key: "2", ctrlKey: true }))).toBe(false);
		expect(editorStore.getState().view).toBe("design");
	});
});
