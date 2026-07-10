type FilterType =
	| "text"
	| "number"
	| "boolean"
	| "date"
	| "select"
	| "multiselect"
	| "custom";

type TextOperator =
	| "contains"
	| "equals"
	| "startsWith"
	| "endsWith"
	| "notContains";
type NumberOperator =
	| "equals"
	| "greaterThan"
	| "lessThan"
	| "greaterThanOrEqual"
	| "lessThanOrEqual"
	| "between";
type BooleanOperator = "equals";
type DateOperator = "equals" | "before" | "after" | "between";
type SelectOperator = "equals" | "notEquals";
type MultiselectOperator = "in" | "notIn" | "intersects";
type CustomOperator = "custom";

interface FilterOptions<T = unknown> {
	caseSensitive?: boolean;
	compare?: (itemValue: unknown, filterValue: unknown, item: T) => boolean;
}

type BaseFilterConfig<T> = FilterOptions<T> & {
	id: string;
	field: string;
	isActive?: boolean;
};

type FilterConfig<T = unknown> = BaseFilterConfig<T>
	& (
		| { type: "text"; operator: TextOperator; value: string }
		| {
				type: "number";
				operator: "between";
				value: { min: number; max: number };
		  }
		| {
				type: "number";
				operator: Exclude<NumberOperator, "between">;
				value: number;
		  }
		| { type: "boolean"; operator: BooleanOperator; value: boolean }
		| {
				type: "date";
				operator: "between";
				value: { min: string | number | Date; max: string | number | Date };
		  }
		| {
				type: "date";
				operator: Exclude<DateOperator, "between">;
				value: string | number | Date;
		  }
		| { type: "select"; operator: SelectOperator; value: string | number }
		| {
				type: "multiselect";
				operator: MultiselectOperator;
				value: (string | number)[];
		  }
		| { type: "custom"; operator: CustomOperator; value: unknown }
	);

type FilterState<T> = FilterConfig<T>[];

export type {
	BooleanOperator,
	CustomOperator,
	DateOperator,
	FilterConfig,
	FilterOptions,
	FilterState,
	FilterType,
	MultiselectOperator,
	NumberOperator,
	SelectOperator,
	TextOperator,
};
