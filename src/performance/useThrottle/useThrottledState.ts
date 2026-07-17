import { useState } from "react";
import type { ThrottleOptions } from "./types.ts";
import { useThrottledCallback } from "./useThrottledCallback";

type UseThrottledStateReturn<T> = [
	T,
	(value: T) => void,
	{
		isPending: boolean;
		cancel: () => void;
		flush: () => void;
		forceSetValue: (value: T) => void;
	},
];

function useThrottledState<T>(
	initialValue: T | (() => T),
	delay: number,
	options: ThrottleOptions = {},
): UseThrottledStateReturn<T> {
	const [state, setState] = useState<T>(initialValue);

	const {
		throttledFunc: setThrottledState,
		isPending,
		cancel,
		flush,
	} = useThrottledCallback(
		(newValue: T) => {
			setState(newValue);
		},
		delay,
		options,
	);

	return [
		state,
		setThrottledState,
		{
			isPending,
			cancel,
			flush,
			forceSetValue: setState,
		},
	] as const;
}

export { type UseThrottledStateReturn, useThrottledState };
