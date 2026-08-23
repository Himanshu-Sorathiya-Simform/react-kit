import { format, getDate, getMonth, getYear } from "@himanshu-sorathiya/datetime";
import { isNullish, toComparableDate } from "../../shared/stateShared/coercion.ts";
import { getValue } from "../../shared/stateShared/utils.ts";
import type {
	DateBucketGranularity,
	Group,
	GroupByCustomLevel,
	NormalizedGroupByLevel,
} from "./types.ts";

// No ambient `process` type required (works without @types/node); defaults
// to "dev" if the environment can't be determined at all.
const isDev =
	(globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
		?.NODE_ENV !== "production";

/** A single key + display label pair a group level resolves an item to. */
type ResolvedKey = { key: string; label: string };

/** A {@link NormalizedGroupByLevel}, pre-resolved into a plain key-lookup function - see {@link resolveLevel}. */
interface ResolvedLevel<T> {
	/** Computes this item's key(s)/label(s) at this level. Never empty - falls back to the Unknown bucket rather than dropping the item. */
	resolveKeys: (item: T) => ResolvedKey[];
}

/** Left-pads a number with zeros to `width` digits - used for sortable date-bucket keys (e.g. `08` not `8`, so `"2026-08"` sorts correctly against `"2026-12"`). */
function padZero(n: number, width = 2): string {
	return String(n).padStart(width, "0");
}

/** Folds a blank/whitespace-only string into `unknownKey`; passes any other string through unchanged. */
function normalizeToKey(value: string, unknownKey: string): string {
	return value.trim() === "" ? unknownKey : value;
}

/**
 * Field-based level. A single raw value and an array-valued raw value are
 * handled through the same path (wrapping a scalar as a one-element array)
 * -- this is what gives array-valued fields (e.g. tags) automatic fan-out
 * membership without needing a separate code path.
 */
function resolveFieldLevel<T>(field: string, unknownKey: string): ResolvedLevel<T> {
	const pathArray = field.split(".");

	return {
		resolveKeys: (item) => {
			const raw = getValue(item, pathArray);
			const rawValues = Array.isArray(raw) ? raw : [raw];

			const seen = new Set<string>();
			const results: ResolvedKey[] = [];

			for (const v of rawValues) {
				// Non-primitives (nested objects) can't be meaningfully
				// String()-coerced into a group key -- skip rather than
				// producing a "[object Object]" bucket.
				if (isNullish(v) || typeof v === "object") continue;

				const key = normalizeToKey(String(v), unknownKey);

				if (key === unknownKey) continue;
				if (!seen.has(key)) {
					seen.add(key);
					results.push({ key, label: key });
				}
			}

			return results.length > 0 ?
					results
				:	[{ key: unknownKey, label: unknownKey }];
		},
	};
}

/**
 * Date-bucketed level. Key is a zero-padded sortable string (e.g.
 * "2026-08") so groups sort correctly regardless of locale; label is a
 * separately formatted human-friendly string (e.g. "August 2026").
 */
function resolveDateLevel<T>(
	field: string,
	bucket: DateBucketGranularity,
	unknownKey: string,
): ResolvedLevel<T> {
	const pathArray = field.split(".");

	return {
		resolveKeys: (item) => {
			const raw = getValue(item, pathArray);
			const date = toComparableDate(raw);

			if (!date) return [{ key: unknownKey, label: unknownKey }];

			const year = getYear(date);

			if (bucket === "year") {
				return [{ key: `${year}`, label: format(date, "yyyy") }];
			}

			const month = getMonth(date);

			if (bucket === "month") {
				return [
					{
						key: `${year}-${padZero(month)}`,
						label: format(date, "MMMM yyyy"),
					},
				];
			}

			const day = getDate(date);

			return [
				{
					key: `${year}-${padZero(month)}-${padZero(day)}`,
					label: format(date, "MMMM dd, yyyy"),
				},
			];
		},
	};
}

/**
 * Custom key-function level. Two independent failure modes are guarded:
 * getKey throwing, and getKey returning a shape other than
 * string | string[] | null | undefined. In dev, either one throws
 * immediately (fail fast, surface the bug during development). In prod,
 * the affected item(s) fall back to the Unknown bucket instead of crashing
 * the whole grouping computation -- warned once per computation, not once
 * per item, to avoid console spam on a large dataset.
 */
function resolveCustomLevel<T>(
	level: GroupByCustomLevel<T>,
	unknownKey: string,
	levelDisplayName: string,
): ResolvedLevel<T> {
	let hasWarnedThisComputation = false;

	return {
		resolveKeys: (item) => {
			let raw: string | string[] | null | undefined;

			try {
				raw = level.getKey(item);
			} catch (error) {
				if (isDev) {
					console.warn(
						`[useGrouping] custom group level "${levelDisplayName}" threw an error while computing a key.`,
						error,
					);
					throw error;
				}

				if (!hasWarnedThisComputation) {
					console.warn(
						`[useGrouping] custom group level "${levelDisplayName}" threw an error for at least one item; affected items were placed in "${unknownKey}".`,
						error,
					);
					hasWarnedThisComputation = true;
				}

				return [{ key: unknownKey, label: unknownKey }];
			}

			if (isNullish(raw)) return [{ key: unknownKey, label: unknownKey }];

			const rawArray = Array.isArray(raw) ? raw : [raw];
			const hasInvalidEntry = rawArray.some((v) => typeof v !== "string");

			if (hasInvalidEntry) {
				if (isDev) {
					console.warn(
						`[useGrouping] custom group level "${levelDisplayName}" returned a non-string key.`,
						{ returned: raw },
					);
					throw new Error(
						`[useGrouping] custom group level "${levelDisplayName}" returned a non-string key.`,
					);
				}

				if (!hasWarnedThisComputation) {
					console.warn(
						`[useGrouping] custom group level "${levelDisplayName}" returned an invalid key for at least one item; affected items were placed in "${unknownKey}".`,
					);
					hasWarnedThisComputation = true;
				}

				return [{ key: unknownKey, label: unknownKey }];
			}

			const seen = new Set<string>();
			const results: ResolvedKey[] = [];

			for (const s of rawArray as string[]) {
				const key = normalizeToKey(s, unknownKey);

				if (key === unknownKey) continue;
				if (!seen.has(key)) {
					seen.add(key);
					results.push({ key, label: key });
				}
			}

			return results.length > 0 ?
					results
				:	[{ key: unknownKey, label: unknownKey }];
		},
	};
}

/** Exhaustiveness guard: a compile error here means a `NormalizedGroupByLevel` variant exists that {@link resolveLevel} doesn't handle. */
function assertNever(value: never): never {
	throw new Error(
		`[useGrouping] unhandled group level type: ${JSON.stringify(value)}`,
	);
}

/**
 * Resolved once per level (not once per item) -- the same "hoist dispatch
 * out of the hot loop" fix already applied in useFilter/useSort.
 */
function resolveLevel<T>(
	level: NormalizedGroupByLevel<T>,
	index: number,
	unknownKey: string,
): ResolvedLevel<T> {
	switch (level.type) {
		case "field":
			return resolveFieldLevel(level.field, unknownKey);

		case "date":
			return resolveDateLevel(level.field, level.bucket ?? "day", unknownKey);

		case "custom":
			return resolveCustomLevel(
				level,
				unknownKey,
				level.id ?? `level ${index + 1}`,
			);

		default:
			return assertNever(level);
	}
}

/**
 * Recursively partitions `items` by each level in turn. An item can be
 * bucketed under multiple keys at any single level (fan-out, e.g. an
 * array-valued field) -- when that happens, the item is present in every
 * matching branch, which means summed leaf-item counts can exceed the
 * original dataset size. That's expected: it reflects genuine multi-group
 * membership, not duplication by mistake.
 *
 * Uses a Map (not a plain object) specifically so first-seen order is
 * preserved without a separate order-tracking array or any non-null
 * assertions when reading keys back out.
 */
function buildGroups<T>(
	items: T[],
	resolvedLevels: ResolvedLevel<T>[],
	levelIndex: number,
): Group<T>[] {
	const level = resolvedLevels[levelIndex];

	if (!level) return [];

	const buckets = new Map<string, { label: string; items: T[] }>();

	for (const item of items) {
		for (const { key, label } of level.resolveKeys(item)) {
			const existing = buckets.get(key);

			if (existing) {
				existing.items.push(item);
			} else {
				buckets.set(key, { label, items: [item] });
			}
		}
	}

	return Array.from(buckets.entries()).map(([key, bucket]) => {
		const subGroups = buildGroups(bucket.items, resolvedLevels, levelIndex + 1);

		return {
			key,
			label: bucket.label,
			items: bucket.items,
			...(subGroups.length > 0 ? { subGroups } : {}),
		};
	});
}

/**
 * Groups `items` per `levels`, hierarchically - the core computation behind
 * {@link useGrouping}'s `groupedArray`.
 *
 * @remarks
 * An empty `levels` array is a distinct case from "grouped by a level that
 * matches nothing" - it returns a single synthetic group (labeled
 * `ungroupedGroupLabel`) containing every item, rather than an empty array.
 *
 * @param items - The (already array-safety-checked) items to group.
 * @param levels - Grouping levels, applied in order - `levels[0]` produces
 * the top-level groups, `levels[1]` subgroups within each, and so on.
 * @param unknownGroupLabel - Label for items unresolvable at a given level - see {@link UseGroupingOptions.unknownGroupLabel}.
 * @param ungroupedGroupLabel - Label for the single group returned when `levels` is empty - see {@link UseGroupingOptions.ungroupedGroupLabel}.
 * @returns Top-level groups, each optionally holding nested `subGroups` per {@link Group}.
 */
function computeGroupedArray<T>(
	items: T[],
	levels: NormalizedGroupByLevel<T>[],
	unknownGroupLabel: string,
	ungroupedGroupLabel: string,
): Group<T>[] {
	if (levels.length === 0) {
		return [
			{
				key: ungroupedGroupLabel,
				label: ungroupedGroupLabel,
				items,
			},
		];
	}

	const resolvedLevels = levels.map((level, index) =>
		resolveLevel(level, index, unknownGroupLabel),
	);

	return buildGroups(items, resolvedLevels, 0);
}

export { computeGroupedArray };
