import { useState } from "react";
import type { DebounceOptions } from "./types.ts";
import { useDebouncedCallback } from "./useDebouncedCallback.ts";

type UseDebouncedStateReturn<T> = [
	T,
	(value: T) => void,
	{
		isPending: boolean;
		cancel: () => void;
		flush: () => void;
		forceSetValue: (value: T) => void;
	},
];

function useDebouncedState<T>(
	initialValue: T | (() => T),
	delay: number,
	options: DebounceOptions = {},
): UseDebouncedStateReturn<T> {
	const [state, setState] = useState<T>(initialValue);

	const {
		debouncedFunc: setDebouncedState,
		cancel,
		flush,
		isPending,
	} = useDebouncedCallback(
		(newValue: T) => {
			setState(newValue);
		},
		delay,
		options,
	);

	return [
		state,
		setDebouncedState,
		{ isPending, cancel, flush, forceSetValue: setState },
	] as const;
}

export { type UseDebouncedStateReturn, useDebouncedState };
