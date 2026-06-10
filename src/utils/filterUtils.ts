/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FilterOptions } from "../hooks/useFilter.ts";

const FILTER_STRATEGIES: Record<
	string,
	Record<
		string,
		(itemValue: any, filterValue: any, options: FilterOptions) => boolean
	>
> = {
	text: {
		contains: (item, filter, options) => {
			if (options?.caseSensitive) return String(item).includes(String(filter));

			return String(item).toLowerCase().includes(String(filter).toLowerCase());
		},

		equals: (item, filter, options) => {
			if (options?.caseSensitive) return String(item) === String(filter);

			return String(item).toLowerCase() === String(filter).toLowerCase();
		},

		startsWith: (item, filter, options) => {
			if (options?.caseSensitive)
				return String(item).startsWith(String(filter));

			return String(item)
				.toLowerCase()
				.startsWith(String(filter).toLowerCase());
		},

		endsWith: (item, filter, options) => {
			if (options?.caseSensitive) return String(item).endsWith(String(filter));

			return String(item).toLowerCase().endsWith(String(filter).toLowerCase());
		},

		notContains: (item, filter, options) => {
			if (options?.caseSensitive)
				return !String(item).includes(String(filter));

			return !String(item)
				.toLowerCase()
				.includes(String(filter).toLowerCase());
		},
	},

	number: {
		equals: (itemVal, filterVal) => Number(itemVal) === Number(filterVal),

		greaterThan: (itemVal, filterVal) => Number(itemVal) > Number(filterVal),

		lessThan: (itemVal, filterVal) => Number(itemVal) < Number(filterVal),

		greaterThanOrEqual: (itemVal, filterVal) =>
			Number(itemVal) >= Number(filterVal),

		lessThanOrEqual: (itemVal, filterVal) =>
			Number(itemVal) <= Number(filterVal),

		between: (itemVal, filterVal) =>
			Number(itemVal) >= Number(filterVal.min)
			&& Number(itemVal) <= Number(filterVal.max),
	},

	boolean: {
		equals: (itemVal, filterVal) => Boolean(itemVal) === Boolean(filterVal),
	},

	date: {
		equals: (itemVal, filterVal) =>
			new Date(itemVal).getTime() === new Date(filterVal).getTime(),

		before: (itemVal, filterVal) =>
			new Date(itemVal).getTime() < new Date(filterVal).getTime(),

		after: (itemVal, filterVal) =>
			new Date(itemVal).getTime() > new Date(filterVal).getTime(),

		between: (itemVal, filterVal) => {
			const itemTime = new Date(itemVal).getTime();

			return (
				itemTime >= new Date(filterVal.min).getTime()
				&& itemTime <= new Date(filterVal.max).getTime()
			);
		},
	},

	select: {
		equals: (itemVal, filterVal) => itemVal === filterVal,

		notEquals: (itemVal, filterVal) => itemVal !== filterVal,
	},

	multiselect: {
		in: (itemVal, filterVal) => filterVal.includes(itemVal),

		notIn: (itemVal, filterVal) => !filterVal.includes(itemVal),

		intersects: (itemVal, filterVal) =>
			itemVal.some((val: any) => filterVal.includes(val)),
	},
};

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

export { FILTER_STRATEGIES, getValue };
