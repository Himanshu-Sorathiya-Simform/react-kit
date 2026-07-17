import { useEffect, useState } from "react";
import type { ThrottleOptions } from "./types.ts";
import { useThrottledCallback } from "./useThrottledCallback";

type UseThrottledValueReturn<T> = T;

function useThrottledValue<T>(
	value: T,
	delay: number,
	options: ThrottleOptions = {},
): UseThrottledValueReturn<T> {
	const [throttledValue, setThrottledValue] = useState<T>(value);

	const { throttledFunc } = useThrottledCallback(
		(newValue: T) => {
			setThrottledValue(newValue);
		},
		delay,
		options,
	);

	useEffect(() => {
		throttledFunc(value);
	}, [value, throttledFunc]);

	return throttledValue;
}

export { type UseThrottledValueReturn, useThrottledValue };
