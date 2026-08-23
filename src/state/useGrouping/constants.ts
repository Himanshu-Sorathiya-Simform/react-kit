/**
 * Default label for the synthetic bucket holding items whose value at a
 * given level is missing, blank, or otherwise unresolvable, in
 * {@link useGrouping} - see `unknownGroupLabel` on
 * {@link UseGroupingOptions}.
 *
 * @defaultValue "Unknown"
 */
const DEFAULT_UNKNOWN_GROUP_LABEL = "Unknown";

/**
 * Default label for the single synthetic group returned by
 * {@link useGrouping} when no grouping is applied - see
 * `ungroupedGroupLabel` on {@link UseGroupingOptions}.
 *
 * @defaultValue "Ungrouped"
 */
const DEFAULT_UNGROUPED_GROUP_LABEL = "Ungrouped";

export { DEFAULT_UNGROUPED_GROUP_LABEL, DEFAULT_UNKNOWN_GROUP_LABEL };
