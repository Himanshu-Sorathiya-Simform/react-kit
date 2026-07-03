/* eslint-disable @typescript-eslint/no-explicit-any */

function getValue(
	obj: any,
	path: string | string[] | undefined,
	fallbackKey?: string,
) {
	if (typeof obj !== "object" || obj === null) {
		return obj;
	}

	const activePath = path ?? fallbackKey ?? "";

	if (Array.isArray(activePath)) {
		return activePath.reduce((current, key) => current?.[key], obj);
	}

	if (!activePath.includes(".")) {
		return obj?.[activePath];
	}

	return activePath.split(".").reduce((current, key) => {
		return current?.[key];
	}, obj);
}

export { getValue };
