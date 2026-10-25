// Vite (and so Vitest) can import any file as a string with `?raw`.
declare module "*?raw" {
	const content: string;
	export default content;
}

// Standard ESM `import.meta.url`; core has no Node or Vite client types.
interface ImportMeta {
	readonly url: string;
}
