type SortType =
	| "numeric"
	| "alphabetical"
	| "alphanumeric"
	| "boolean"
	| "date"
	| "basic"
	| "custom";

interface BaseSortOptions {
	desc?: boolean;
	disableSortRemoval?: boolean;
	invertSorting?: boolean;
	sortUndefined?: "first" | "last" | -1 | 1;
}

interface BaseSortConfig extends BaseSortOptions {
	id: string;
	field?: string;
}

type SortConfig = BaseSortConfig
	& (
		| { type: "numeric" | "boolean" | "date" | "basic" }
		| { type: "alphabetical" | "alphanumeric"; caseSensitive?: boolean }
		| { type: "custom"; compare: (a: unknown, b: unknown) => number }
	);

type SortState = SortConfig[];

type SortOptionsForType<T extends SortType> = Omit<
	Extract<SortConfig, { type: T }>,
	"id" | "type" | "field"
>;

export type {
	BaseSortConfig,
	BaseSortOptions,
	SortConfig,
	SortOptionsForType,
	SortState,
	SortType,
};
