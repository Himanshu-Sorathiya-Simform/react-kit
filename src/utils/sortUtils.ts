/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SortOptionsForType } from "../types/sort.types.ts";

function compareBooleans(
	a: unknown,
	b: unknown,
	options: SortOptionsForType<"boolean"> = {},
) {
	const { sortUndefined, desc = false } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const valueA = Boolean(a);
	const valueB = Boolean(b);

	if (valueA === valueB) return 0;

	return valueA ? 1 : -1;
}

function compareNumbers(
	a: unknown,
	b: unknown,
	options: SortOptionsForType<"numeric"> = {},
) {
	const { sortUndefined, desc = false } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const numA = Number(a);
	const numB = Number(b);

	const isANaN = Number.isNaN(numA);
	const isBNaN = Number.isNaN(numB);

	if (isANaN || isBNaN) {
		return (
			handleUndefinedSort(
				isANaN ? undefined : numA,
				isBNaN ? undefined : numB,
				sortUndefined,
				desc,
			) ?? 0
		);
	}

	return numA - numB;
}

function compareAlphabetical(
	a: unknown,
	b: unknown,
	options: SortOptionsForType<"alphabetical"> = {},
) {
	const { desc = false, sortUndefined, caseSensitive = false } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const stringA = String(a);
	const stringB = String(b);

	return stringA.localeCompare(stringB, undefined, {
		sensitivity: caseSensitive ? "variant" : "base",
	});
}

function compareAlphanumeric(
	a: unknown,
	b: unknown,
	options: SortOptionsForType<"alphanumeric"> = {},
) {
	const { desc = false, sortUndefined, caseSensitive = false } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const stringA = String(a);
	const stringB = String(b);

	return stringA.localeCompare(stringB, undefined, {
		numeric: true,
		sensitivity: caseSensitive ? "variant" : "base",
	});
}

function compareDates(
	a: unknown,
	b: unknown,
	options: SortOptionsForType<"date"> = {},
) {
	const { desc = false, sortUndefined } = options;

	let undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const timeA = new Date(a as any).getTime();
	const timeB = new Date(b as any).getTime();

	const isANaN = Number.isNaN(timeA);
	const isBNaN = Number.isNaN(timeB);

	if (isANaN || isBNaN) {
		undefinedResult = handleUndefinedSort(
			isANaN ? undefined : timeA,
			isBNaN ? undefined : timeB,
			sortUndefined,
			desc,
		);

		if (undefinedResult !== null) return undefinedResult;
	}

	return timeA - timeB;
}

function compareBasic(
	a: unknown,
	b: unknown,
	options: SortOptionsForType<"basic"> = {},
) {
	const { desc = false, sortUndefined } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	return (
		(a as any) < (b as any) ? -1
		: (a as any) > (b as any) ? 1
		: 0
	);
}

function compareCustom(
	a: unknown,
	b: unknown,
	options: Partial<SortOptionsForType<"custom">> = {},
) {
	const { desc = false, sortUndefined, compare } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	if (typeof compare === "function") {
		return compare(a, b);
	}

	return (
		(a as any) < (b as any) ? -1
		: (a as any) > (b as any) ? 1
		: 0
	);
}

function handleUndefinedSort(
	a: unknown,
	b: unknown,
	option: "first" | "last" | -1 | 1 = "last",
	isDescending: boolean,
) {
	const aIsMissing = a === undefined || a === null || a === "";
	const bIsMissing = b === undefined || b === null || b === "";

	if (aIsMissing && bIsMissing) return 0;

	if (!aIsMissing && !bIsMissing) return null;

	if (option === "first") {
		return aIsMissing ? -1 : 1;
	}

	if (option === "last") {
		return aIsMissing ? 1 : -1;
	}

	if (option === -1) {
		const order = isDescending ? 1 : -1;

		return aIsMissing ? order : -order;
	}

	if (option === 1) {
		const order = isDescending ? 1 : -1;

		return aIsMissing ? -order : order;
	}

	return null;
}

export {
	compareAlphabetical,
	compareAlphanumeric,
	compareBasic,
	compareBooleans,
	compareCustom,
	compareDates,
	compareNumbers,
};
