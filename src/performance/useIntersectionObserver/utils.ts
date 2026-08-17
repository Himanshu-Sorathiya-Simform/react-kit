import type { IntersectionTargetInput } from "./types";

/** Resolves any {@link IntersectionTargetInput} shape down to a plain element or null. */
function resolveTarget(input: IntersectionTargetInput | undefined): Element | null {
	if (!input) return null;
	if (typeof input === "function") return input();
	if ("current" in input) return input.current;

	return input;
}

export { resolveTarget };
