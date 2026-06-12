/* eslint-disable @typescript-eslint/no-explicit-any */

function getValue(obj: any, path: string | undefined, fallbackKey?: string) {
	if (typeof obj !== "object" || obj === null) {
		return obj;
	}

	const activePath = (path || fallbackKey) ?? "";

	if (!activePath.includes(".")) {
		return obj?.[activePath];
	}

	return activePath.split(".").reduce((current, key) => {
		return current?.[key];
	}, obj);
}

export { getValue };
