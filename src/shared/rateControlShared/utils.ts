/**
 * Type guard distinguishing a React `useState`-style functional updater
 * (`(previous: T) => T`) from a plain value (`T`), for setters that accept
 * both call forms.
 *
 * @remarks
 * This can't fully narrow when `T` itself is an unconstrained generic that
 * could be a function type — the same ambiguity `useState`'s own setter
 * has. If your value's type is itself a function, always pass the updater
 * form explicitly (e.g. `setValue(() => myFunction)`) rather than
 * `setValue(myFunction)`.
 *
 * @param value - Either a plain value or an updater function.
 * @returns `true` if `value` is a function, narrowing it to the updater
 * signature.
 */
function isUpdaterFunction<T>(
	value: T | ((previous: T) => T),
): value is (previous: T) => T {
	return typeof value === "function";
}

export { isUpdaterFunction };
