/* eslint-disable @typescript-eslint/no-explicit-any */

const FILTER_STRATEGIES: Record<
	string,
	Record<string, (itemValue: any, filterValue: any, config: any) => boolean>
> = {
	text: {
		contains: (item, filter, config) => {
			if (config?.caseSensitive) return String(item).includes(String(filter));

			return String(item).toLowerCase().includes(String(filter).toLowerCase());
		},

		equals: (item, filter, config) => {
			if (config?.caseSensitive) return String(item) === String(filter);

			return String(item).toLowerCase() === String(filter).toLowerCase();
		},

		startsWith: (item, filter, config) => {
			if (config?.caseSensitive)
				return String(item).startsWith(String(filter));

			return String(item)
				.toLowerCase()
				.startsWith(String(filter).toLowerCase());
		},

		endsWith: (item, filter, config) => {
			if (config?.caseSensitive) return String(item).endsWith(String(filter));

			return String(item).toLowerCase().endsWith(String(filter).toLowerCase());
		},

		notContains: (item, filter, config) => {
			if (config?.caseSensitive) return !String(item).includes(String(filter));

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
		equals: (itemVal, filterVal) => {
			if (!itemVal || !filterVal) return false;

			const itemTime = new Date(itemVal).getTime();
			const filterTime = new Date(filterVal).getTime();

			if (Number.isNaN(itemTime) || Number.isNaN(filterTime)) return false;

			return itemTime === filterTime;
		},

		before: (itemVal, filterVal) => {
			if (!itemVal || !filterVal) return false;

			const itemTime = new Date(itemVal).getTime();
			const filterTime = new Date(filterVal).getTime();

			if (Number.isNaN(itemTime) || Number.isNaN(filterTime)) return false;

			return itemTime < filterTime;
		},

		after: (itemVal, filterVal) => {
			if (!itemVal || !filterVal) return false;

			const itemTime = new Date(itemVal).getTime();
			const filterTime = new Date(filterVal).getTime();

			if (Number.isNaN(itemTime) || Number.isNaN(filterTime)) return false;

			return itemTime > filterTime;
		},

		between: (itemVal, filterVal) => {
			if (!itemVal || !filterVal?.min || !filterVal?.max) return false;

			const itemTime = new Date(itemVal).getTime();
			const minTime = new Date(filterVal.min).getTime();
			const maxTime = new Date(filterVal.max).getTime();
			if (
				Number.isNaN(itemTime)
				|| Number.isNaN(minTime)
				|| Number.isNaN(maxTime)
			)
				return false;

			return itemTime >= minTime && itemTime <= maxTime;
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

export { FILTER_STRATEGIES };
