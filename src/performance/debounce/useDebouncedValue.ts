import { useEffect, useState } from "react";
import type { DebounceOptions } from "./types.ts";
import { useDebounce } from "./useDebounce";

type UseDebouncedValueReturn<T> = T;

function useDebouncedValue<T>(
	value: T,
	delay: number,
	options: DebounceOptions = {},
): UseDebouncedValueReturn<T> {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	const { debouncedFunc } = useDebounce(
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
