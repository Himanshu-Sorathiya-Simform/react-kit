import {
	type DateInput,
	isDate,
	isValid,
	toDate,
} from "@himanshu-sorathiya/datetime";

type MinMaxRange = { min: unknown; max: unknown };

function isNullish(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

function isDateLike(value: unknown): value is string | number | Date {
	return isDate(value) || typeof value === "string" || typeof value === "number";
}

function isTextComparable(value: unknown): value is string | number | boolean {
	return (
		typeof value === "string"
		|| typeof value === "number"
		|| typeof value === "boolean"
	);
}

function toFiniteNumber(value: unknown): number | null {
	if (isNullish(value) || typeof value === "boolean") return null;
	if (typeof value !== "number" && typeof value !== "string") return null;
	if (typeof value === "string" && value.trim() === "") return null;

	const num = Number(value);

	return Number.isNaN(num) ? null : num;
}

function toBooleanOrNull(value: unknown): boolean | null {
	if (isNullish(value)) return null;

	if (typeof value === "boolean") return value;

	if (typeof value === "number") {
		if (value === 1) return true;
		if (value === 0) return false;

		return null;
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();

		if (normalized === "true" || normalized === "1") return true;
		if (normalized === "false" || normalized === "0") return false;

		return null;
	}

	return null;
}

function isMinMaxRange(value: unknown): value is MinMaxRange {
	return (
		typeof value === "object"
		&& value !== null
		&& !Array.isArray(value)
		&& "min" in value
		&& "max" in value
	);
}

function toComparableDate(value: unknown): Date | null {
	if (isNullish(value)) return null;

	const date = toDate(value as DateInput);

	return isValid(date) ? date : null;
}

export {
	isDateLike,
	isMinMaxRange,
	isNullish,
	isTextComparable,
	toBooleanOrNull,
	toComparableDate,
	toFiniteNumber,
};
