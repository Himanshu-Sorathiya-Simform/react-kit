/**
 * `Omit<T, K>`, applied per union member instead of to the flattened union
 * as a whole - plain `Omit` over a union loses the correlation between
 * `type`/`operator` and that arm's own `value` shape, which is exactly the
 * information {@link FilterConfigUpdate} needs to preserve.
 */
type DistributiveOmit<T, K extends PropertyKey> =
	T extends unknown ? Omit<T, K> : never;

/** `Partial<T>`, applied per union member - same distributive reasoning as {@link DistributiveOmit}. */
type DistributivePartial<T> = T extends unknown ? Partial<T> : never;

export type { DistributiveOmit, DistributivePartial };
