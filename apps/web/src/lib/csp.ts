// The server fills this in per response; Vite's dev server leaves it as is.
const PLACEHOLDER = "__GLAZE_CSP_NONCE__";

/**
 * Reads the Content-Security-Policy nonce the server put into `index.html`.
 * CodeMirror needs it for the `<style>` elements it creates, because the CSP
 * doesn't allow inline styles without one.
 * @returns The nonce, or `""` when there is none (dev server, tests).
 */
export function cspNonce(): string {
	const meta = document.querySelector<HTMLMetaElement>(
		'meta[name="glaze-csp-nonce"]',
	);
	const nonce = meta?.content ?? "";
	return nonce === PLACEHOLDER ? "" : nonce;
}
