// Vite (and so Vitest) can import any file as a string with `?raw`.
declare module "*?raw" {
	const content: string;
	export default content;
}
