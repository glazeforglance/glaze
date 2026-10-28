import { describe, expect, it } from "vitest";
import {
	CONTAINER_LISTEN_WARNING,
	changedListenOptions,
	glanceRunsInContainer,
	HOST_NOT_A_URL,
	isIPv6,
	serverOptionProblem,
	serverSectionChanged,
	validateServerOptions,
} from "../src/index.ts";
import { load } from "./helpers/line-diff.ts";

const PAGES = "pages:\n  - name: Home\n    columns:\n      - size: full\n";

function withServer(lines: string): string {
	return `server:\n${lines}${PAGES}`;
}

describe("serverOptionProblem: host", () => {
	it.each([
		"",
		"0.0.0.0",
		"192.168.178.233",
		"localhost",
		"glance.lan",
		"my-server.example.com",
		"[::1]",
		"[fe80::1]",
		"[::ffff:192.168.1.2]",
	])("accepts %j", (host) => {
		expect(serverOptionProblem("host", host)).toBeNull();
	});

	it("refuses the URL from the real bug report", () => {
		expect(serverOptionProblem("host", "http://192.168.178.233")).toEqual({
			code: "host-is-url",
			message: HOST_NOT_A_URL,
		});
	});

	it.each([
		"https://glance.lan",
		"192.168.1.2:8088",
		"glance.lan/dashboard",
		"[::1]:8080",
	])("refuses a URL, port or path in %j", (host) => {
		expect(serverOptionProblem("host", host)?.code).toBe("host-is-url");
	});

	it("asks for brackets around a bare IPv6 address", () => {
		const problem = serverOptionProblem("host", "::1");
		expect(problem?.code).toBe("host-ipv6-needs-brackets");
		expect(problem?.params).toEqual({ host: "::1" });
		expect(problem?.message).toContain("[::1]");
	});

	it.each(["300.1.1.1", "1.2.3", "bad host", "-glance", "[nope]", "[::1"])(
		"refuses %j",
		(host) => {
			expect(serverOptionProblem("host", host)).not.toBeNull();
		},
	);

	it("skips env placeholders and missing values", () => {
		expect(serverOptionProblem("host", "${GLANCE_HOST}")).toBeNull();
		expect(serverOptionProblem("host", undefined)).toBeNull();
		expect(serverOptionProblem("host", null)).toBeNull();
	});
});

describe("serverOptionProblem: port", () => {
	it.each([1, 8080, 65535])("accepts %d", (port) => {
		expect(serverOptionProblem("port", port)).toBeNull();
	});

	it.each([0, 65536, -1, 80.5, "8088", true])("refuses %j", (port) => {
		const problem = serverOptionProblem("port", port);
		expect(problem?.code).toBe("port-invalid");
		expect(problem?.message).toContain("1 to 65535");
	});

	it("skips env placeholders", () => {
		expect(serverOptionProblem("port", "${PORT}")).toBeNull();
	});
});

describe("serverOptionProblem: base-url", () => {
	it.each(["", "/", "/glance", "/glance/", "https://example.com/glance"])(
		"accepts %j",
		(value) => {
			expect(serverOptionProblem("base-url", value)).toBeNull();
		},
	);

	it.each(["glance", "example.com/glance", "ftp://example.com", 5])(
		"refuses %j",
		(value) => {
			const problem = serverOptionProblem("base-url", value);
			expect(problem?.code).toBe("base-url-invalid");
			expect(problem?.message).toContain("start with /");
		},
	);
});

describe("isIPv6", () => {
	it.each(["::", "::1", "2001:db8::8a2e:370:7334", "1:2:3:4:5:6:7:8"])(
		"accepts %j",
		(text) => expect(isIPv6(text)).toBe(true),
	);
	it.each(["1:2:3", "1::2::3", "12345::", "1:2:3:4:5:6:7:8:9", "::1.2.3"])(
		"refuses %j",
		(text) => expect(isIPv6(text)).toBe(false),
	);
});

describe("validateServerOptions", () => {
	it("is empty for a config without a server section", () => {
		expect(validateServerOptions(load(PAGES))).toEqual([]);
	});

	it("reports each broken option at its path", () => {
		const doc = load(
			withServer(
				"  host: http://192.168.178.233\n  port: 99999\n  base-url: glance\n",
			),
		);
		expect(validateServerOptions(doc)).toEqual([
			{
				key: "host",
				path: ["server", "host"],
				code: "host-is-url",
				message: HOST_NOT_A_URL,
			},
			{
				key: "port",
				path: ["server", "port"],
				code: "port-invalid",
				message: expect.stringContaining("65535"),
			},
			{
				key: "base-url",
				path: ["server", "base-url"],
				code: "base-url-invalid",
				message: expect.stringContaining("start with /"),
			},
		]);
	});

	it("accepts a typical config", () => {
		const doc = load(withServer("  port: 8080\n  assets-path: /app/assets\n"));
		expect(validateServerOptions(doc)).toEqual([]);
	});
});

describe("changedListenOptions", () => {
	it("treats a missing port as 8080 and a missing host as empty", () => {
		const before = load(PAGES);
		const after = load(withServer('  port: 8080\n  host: ""\n'));
		expect(changedListenOptions(before, after)).toEqual([]);
	});

	it("finds a changed port and host", () => {
		const before = load(withServer("  port: 8080\n"));
		expect(
			changedListenOptions(before, load(withServer("  port: 8088\n"))),
		).toEqual(["port"]);
		expect(
			changedListenOptions(
				before,
				load(withServer("  port: 8080\n  host: 192.168.1.2\n")),
			),
		).toEqual(["host"]);
	});

	it("ignores other server options", () => {
		const before = load(withServer("  port: 8080\n"));
		const after = load(withServer("  port: 8080\n  base-url: /glance\n"));
		expect(changedListenOptions(before, after)).toEqual([]);
	});
});

describe("serverSectionChanged", () => {
	it("ignores comments and changes outside server", () => {
		const before = load(withServer("  port: 8080\n"));
		const after = load(
			withServer("  port: 8080 # default\n").replace("Home", "Start"),
		);
		expect(serverSectionChanged(before, after)).toBe(false);
	});

	it("sees added, changed and removed options", () => {
		const before = load(withServer("  port: 8080\n"));
		expect(
			serverSectionChanged(
				before,
				load(withServer("  port: 8080\n  base-url: /g\n")),
			),
		).toBe(true);
		expect(serverSectionChanged(before, load(PAGES))).toBe(true);
	});
});

describe("glanceRunsInContainer", () => {
	it("is true when Glaze runs in a container", () => {
		expect(
			glanceRunsInContainer({
				glazeInContainer: true,
				glanceUrl: null,
				port: 8080,
			}),
		).toBe(true);
	});

	it("is true when GLANCE_URL uses another port (the ZimaOS case)", () => {
		expect(
			glanceRunsInContainer({
				glazeInContainer: false,
				glanceUrl: "http://192.168.178.233:8088",
				port: undefined,
			}),
		).toBe(true);
	});

	it("is false when the ports match or nothing is known", () => {
		expect(
			glanceRunsInContainer({
				glazeInContainer: false,
				glanceUrl: "http://localhost:8080",
				port: 8080,
			}),
		).toBe(false);
		expect(
			glanceRunsInContainer({
				glazeInContainer: false,
				glanceUrl: null,
				port: 8080,
			}),
		).toBe(false);
		expect(
			glanceRunsInContainer({
				glazeInContainer: false,
				glanceUrl: "http://localhost:9000",
				port: "${PORT}",
			}),
		).toBe(false);
	});

	it("has a warning text that names the port mapping", () => {
		expect(CONTAINER_LISTEN_WARNING).toContain("port mapping");
	});
});
