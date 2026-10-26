import type { Context, MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";
import { NONCE, secureHeaders } from "hono/secure-headers";

/** CSP directives, in the shape `secureHeaders` expects. */
export type CspDirectives = NonNullable<
	NonNullable<Parameters<typeof secureHeaders>[0]>["contentSecurityPolicy"]
>;

/** Context key where `secureHeaders` stores this response's CSP nonce. */
export const CSP_NONCE_KEY = "secureHeadersNonce";

/**
 * Builds the Content-Security-Policy for the Glaze UI. Everything comes from
 * Glaze itself, except the live preview: Glance is framed (`frame-src`) and
 * polled after Publish (`connect-src`), so its origin is allowed there only.
 *
 * `style-src` adds a per-response nonce: CodeMirror (via `style-mod`) puts its
 * theme in `<style>` elements, which a plain `'self'` would block. The nonce
 * goes into `index.html`, CodeMirror copies it onto its `<style>` tags
 * (`EditorView.cspNonce`), and no `'unsafe-inline'` is needed. Styles that
 * React and CodeMirror set through `element.style` aren't affected by CSP.
 * @param glanceUrl - `GLANCE_URL`, or `null` when the preview is off.
 * @returns The directives.
 */
export function contentSecurityPolicy(glanceUrl: string | null): CspDirectives {
	const glance = glanceUrl ? [new URL(glanceUrl).origin] : [];
	return {
		defaultSrc: ["'self'"],
		scriptSrc: ["'self'"],
		styleSrc: ["'self'", NONCE],
		// data: for small inline SVG/PNG icons that CSS or widgets may use.
		imgSrc: ["'self'", "data:"],
		// Vite inlines small font subsets (< 4 kB) as data: URIs; fonts can't run code.
		fontSrc: ["'self'", "data:"],
		connectSrc: ["'self'", ...glance],
		frameSrc: glance.length > 0 ? glance : ["'none'"],
		frameAncestors: ["'none'"],
		objectSrc: ["'none'"],
		baseUri: ["'self'"],
		formAction: ["'self'"],
	};
}

/**
 * Security headers for every response: the CSP above, `X-Frame-Options`,
 * `nosniff`, a strict referrer policy and so on (Hono's defaults).
 * @param glanceUrl - `GLANCE_URL`, or `null`.
 * @returns The middleware.
 */
export function securityHeaders(glanceUrl: string | null): MiddlewareHandler {
	return secureHeaders({
		contentSecurityPolicy: contentSecurityPolicy(glanceUrl),
		// HSTS belongs to whoever terminates TLS; on plain-HTTP LAN setups it would break access.
		strictTransportSecurity: false,
		// The default `require-corp` would block the cross-origin Glance iframe.
		crossOriginEmbedderPolicy: false,
	});
}

/** The origin the browser used, as the proxy saw it (for `GLAZE_TRUST_PROXY`). */
function forwardedOrigin(c: Context): string | null {
	const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
	const host = (
		c.req.header("x-forwarded-host") ??
		c.req.header("host") ??
		new URL(c.req.url).host
	)
		.split(",")[0]
		?.trim();
	return proto && host ? `${proto}://${host}` : null;
}

/**
 * CSRF protection on top of `SameSite=Strict` cookies: Hono's `csrf()`
 * refuses non-GET requests that a plain HTML form could send (form or
 * `text/plain` bodies) unless `Origin` or `Sec-Fetch-Site` shows they come
 * from Glaze itself. JSON requests from another site need a CORS preflight,
 * which Glaze never answers, so they can't get through either.
 * @param trustProxy - Also accept the origin rebuilt from `X-Forwarded-*`
 *   (behind TLS-terminating proxies Glaze itself only sees `http://`).
 * @returns The middleware.
 */
export function csrfProtection(trustProxy: boolean): MiddlewareHandler {
	return csrf({
		origin: (origin, c) =>
			origin === new URL(c.req.url).origin ||
			(trustProxy && origin === forwardedOrigin(c)),
	});
}
