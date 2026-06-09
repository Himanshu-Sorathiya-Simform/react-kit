/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SortOptions } from "../hooks/useSort.ts";

function compareBooleans(a: any, b: any, options: SortOptions = {}) {
	const { sortUndefined, desc = false } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const valueA = Boolean(a);
	const valueB = Boolean(b);

	if (valueA === valueB) return 0;

	return valueA ? 1 : -1;
}

function compareNumbers(a: any, b: any, options: SortOptions = {}) {
	const { sortUndefined, desc = false } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const valueA = Number.isNaN(Number(a)) ? 0 : Number(a);
	const valueB = Number.isNaN(Number(b)) ? 0 : Number(b);

	return valueA - valueB;
}

function compareAlphabetical(a: any, b: any, options: SortOptions = {}) {
	const { desc = false, sortUndefined, caseSensitive = false } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const stringA = String(a);
	const stringB = String(b);

	return stringA.localeCompare(stringB, undefined, {
		sensitivity: caseSensitive ? "variant" : "base",
	});
}

function compareAlphanumeric(a: any, b: any, options: SortOptions = {}) {
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

function compareDates(a: any, b: any, options: SortOptions = {}) {
	const { desc = false, sortUndefined } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	const timeA = new Date(a).getTime();
	const timeB = new Date(b).getTime();

	const cleanA = Number.isNaN(timeA) ? 0 : timeA;
	const cleanB = Number.isNaN(timeB) ? 0 : timeB;

	return cleanA - cleanB;
}

function compareBasic(a: any, b: any, options: SortOptions = {}) {
	const { desc = false, sortUndefined } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	return (
		a < b ? -1
		: a > b ? 1
		: 0
	);
}

function compareCustom(a: any, b: any, options: SortOptions = {}) {
	const { desc = false, sortUndefined, compare } = options;

	const undefinedResult = handleUndefinedSort(a, b, sortUndefined, desc);

	if (undefinedResult !== null) return undefinedResult;

	if (typeof compare === "function") {
		return compare(a, b);
	}

	return (
		a < b ? -1
		: a > b ? 1
		: 0
	);
}

function getValue(obj: any, path: string | undefined, fallbackKey: string) {
	if (typeof obj !== "object" || obj === null) {
		return obj;
	}

	const activePath = path || fallbackKey;

	if (!activePath.includes(".")) {
		return obj?.[activePath];
	}

	return activePath.split(".").reduce((current, key) => {
		return current?.[key];
	}, obj);
}

function handleUndefinedSort(
	a: any,
	b: any,
	option: "first" | "last" | false | -1 | 1 = false,
	isDescending: boolean,
) {
	const aVal = a ?? undefined;
	const bVal = b ?? undefined;

	if (aVal !== undefined && bVal !== undefined) return null;
	if (aVal === undefined && bVal === undefined) return 0;

	if (option === false) return 0;

	if (option === "first") return aVal === undefined ? -1 : 1;

	if (option === "last") return aVal === undefined ? 1 : -1;

	if (option === -1) {
		const order = isDescending ? 1 : -1;

		return aVal === undefined ? order : -order;
	}

	if (option === 1) {
		const order = isDescending ? 1 : -1;

		return aVal === undefined ? -order : order;
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
	getValue,
};
