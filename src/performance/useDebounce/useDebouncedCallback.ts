import { useCallback, useEffect, useRef } from "react";
import type { DebounceOptions } from "./types.ts";
import { useDebounce } from "./useDebounce";

interface UseDebouncedCallbackReturn<Args extends unknown[]> {
	debouncedFunc: (...args: Args) => void;
	cancel: () => void;
	flush: () => void;
	isPending: boolean;
}

function useDebouncedCallback<Args extends unknown[]>(
	func: (...args: Args) => void,
	delay: number,
	options: DebounceOptions = {},
): UseDebouncedCallbackReturn<Args> {
	const funcRef = useRef(func);

	useEffect(() => {
		funcRef.current = func;
	}, [func]);

	const { run, cancel, flush, isPending } = useDebounce(delay, options);

	const debouncedFunc = useCallback(
		(...args: Args) => {
			run(funcRef.current, ...args);
		},
		[run],
	);

	return { debouncedFunc, cancel, flush, isPending };
}

export { type UseDebouncedCallbackReturn, useDebouncedCallback };
