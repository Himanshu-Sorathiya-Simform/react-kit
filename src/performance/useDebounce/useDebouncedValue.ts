import { useEffect, useState } from "react";
import type { DebounceOptions } from "./types.ts";
import { useDebouncedCallback } from "./useDebouncedCallback.ts";

type UseDebouncedValueReturn<T> = T;

function useDebouncedValue<T>(
	value: T,
	delay: number,
	options: DebounceOptions = {},
): UseDebouncedValueReturn<T> {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	const { debouncedFunc } = useDebouncedCallback(
		(newValue: T) => {
			setDebouncedValue(newValue);
		},
		delay,
		options,
	);

	useEffect(() => {
		debouncedFunc(value);
	}, [value, debouncedFunc]);

	return debouncedValue;
}

export { type UseDebouncedValueReturn, useDebouncedValue };
