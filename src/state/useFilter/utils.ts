/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterStrategyConfig = {
	caseSensitive?: boolean | undefined;
};

const FILTER_STRATEGIES: Record<
	string,
	Record<
		string,
		(
			itemValue: unknown,
			filterValue: unknown,
			config: FilterStrategyConfig,
		) => boolean
	>
> = {
	text: {
		contains: (item, filter, config) => {
			if (item === null || item === undefined) return false;

			if (config?.caseSensitive) {
				return String(item).includes(String(filter));
			}

			return String(item).toLowerCase().includes(String(filter).toLowerCase());
		},

		equals: (item, filter, config) => {
			if (item === null || item === undefined) return false;

			if (config?.caseSensitive) {
				return String(item) === String(filter);
			}

			return String(item).toLowerCase() === String(filter).toLowerCase();
		},

		startsWith: (item, filter, config) => {
			if (item === null || item === undefined) return false;

			if (config?.caseSensitive) {
				return String(item).startsWith(String(filter));
			}

			return String(item)
				.toLowerCase()
				.startsWith(String(filter).toLowerCase());
		},

		endsWith: (item, filter, config) => {
			if (item === null || item === undefined) return false;

			if (config?.caseSensitive) {
				return String(item).endsWith(String(filter));
			}

			return String(item).toLowerCase().endsWith(String(filter).toLowerCase());
		},

		notContains: (item, filter, config) => {
			if (item === null || item === undefined) return true;

			if (config?.caseSensitive) {
				return !String(item).includes(String(filter));
			}

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

		between: (itemVal, filterVal) => {
			if (typeof filterVal !== "object" || filterVal === null) return false;

			const { min, max } = filterVal as { min: unknown; max: unknown };
			if (
				min === undefined
				|| min === null
				|| max === undefined
				|| max === null
			)
				return false;

			return Number(itemVal) >= Number(min) && Number(itemVal) <= Number(max);
		},
	},

	boolean: {
		equals: (itemVal, filterVal) => Boolean(itemVal) === Boolean(filterVal),
	},

	date: {
		equals: (itemVal, filterVal) => {
			if (!itemVal || !filterVal) return false;

			const itemDate = new Date(itemVal as any);
			const filterDate = new Date(filterVal as any);

			if (
				Number.isNaN(itemDate.getTime())
				|| Number.isNaN(filterDate.getTime())
			)
				return false;

			return (
				itemDate.getFullYear() === filterDate.getFullYear()
				&& itemDate.getMonth() === filterDate.getMonth()
				&& itemDate.getDate() === filterDate.getDate()
			);
		},

		before: (itemVal, filterVal) => {
			if (!itemVal || !filterVal) return false;

			const itemTime = new Date(itemVal as any).setHours(0, 0, 0, 0);
			const filterTime = new Date(filterVal as any).setHours(0, 0, 0, 0);

			if (Number.isNaN(itemTime) || Number.isNaN(filterTime)) return false;

			return itemTime < filterTime;
		},

		after: (itemVal, filterVal) => {
			if (!itemVal || !filterVal) return false;

			const itemTime = new Date(itemVal as any).setHours(0, 0, 0, 0);
			const filterTime = new Date(filterVal as any).setHours(0, 0, 0, 0);

			if (Number.isNaN(itemTime) || Number.isNaN(filterTime)) return false;

			return itemTime > filterTime;
		},

		between: (itemVal, filterVal) => {
			if (!itemVal || typeof filterVal !== "object" || filterVal === null)
				return false;

			const { min, max } = filterVal as { min: unknown; max: unknown };
			if (
				min === undefined
				|| min === null
				|| max === undefined
				|| max === null
			)
				return false;

			const itemTime = new Date(itemVal as any).setHours(0, 0, 0, 0);
			const minTime = new Date(min as any).setHours(0, 0, 0, 0);
			const maxTime = new Date(max as any).setHours(0, 0, 0, 0);

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
		in: (itemVal, filterVal) => (filterVal as unknown[]).includes(itemVal),

		notIn: (itemVal, filterVal) => !(filterVal as unknown[]).includes(itemVal),

		intersects: (itemVal, filterVal) =>
			(itemVal as unknown[]).some((val) =>
				(filterVal as unknown[]).includes(val),
			),
	},
};

export { FILTER_STRATEGIES };
