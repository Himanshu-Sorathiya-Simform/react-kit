import { useEffect, useState } from "react";
import { useDebounce } from "./useDebounce";

interface DebouncedValueOptions {
	maxWait?: number;
	leading?: boolean;
	trailing?: boolean;
}

type UseDebouncedValueReturn<T> = T;

function useDebouncedValue<T>(
	value: T,
	delay: number,
	options: DebouncedValueOptions = {},
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
