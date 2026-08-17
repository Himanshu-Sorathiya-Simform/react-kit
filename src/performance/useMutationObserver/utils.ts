import type { MutationTargetInput } from "./types";

/** Resolves any {@link MutationTargetInput} shape down to a plain node or null. */
function resolveTarget(input: MutationTargetInput | undefined): Node | null {
	if (!input) return null;
	if (typeof input === "function") return input();
	if ("current" in input) return input.current;

	return input;
}

export { resolveTarget };
