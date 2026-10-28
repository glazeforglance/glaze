import { existsSync } from "node:fs";

/** Files a container runtime puts in every container (Docker, Podman). */
const CONTAINER_MARKERS = ["/.dockerenv", "/run/.containerenv"];

/**
 * Tells whether Glaze runs in a container. Then Glance almost surely does
 * too, behind a port mapping that `glance.yml` can't change.
 * @param exists - Checks whether a path exists; only replaced in tests.
 * @returns True when a container marker file exists.
 */
export function runsInContainer(
	exists: (path: string) => boolean = existsSync,
): boolean {
	return CONTAINER_MARKERS.some((path) => exists(path));
}
