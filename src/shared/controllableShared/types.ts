/**
 * A setState-style dispatcher that accepts either a next value directly or a
 * functional updater that receives the previous value and returns the next.
 *
 * Mirrors React's own `Dispatch<SetStateAction<T>>` signature so that
 * downstream hooks can use the same updater patterns they would with plain
 * `useState`.
 *
 * @typeParam T - The type of the value being controlled. Always the type of
 * what the updater must *return*, and of a direct (non-functional) dispatch.
 * @typeParam Prev - The type of the `prev` argument the functional updater
 * receives. Defaults to `T`. `useControllableState` sets this to `T | undefined`
 * for the overload that has no `fallbackValue` — see the note there for why.
 */
type ControllableDispatch<T, Prev = T> = (value: T | ((prev: Prev) => T)) => void;

/**
 * The full options bag consumed by {@link useControllableState}.
 *
 * @typeParam T - The type of the value being controlled.
 */
interface UseControllableStateOptions<T> {
	/**
	 * The controlled value, supplied by the consumer.
	 *
	 * @remarks
	 * When this prop is **not** `undefined` the hook operates in **controlled
	 * mode**: it does **not** keep its own internal state and instead treats
	 * this value as the single source of truth on every render.
	 *
	 * When this prop is `undefined` the hook falls back to **uncontrolled
	 * mode** and manages its own `useState`-based state internally, seeded
	 * from {@link UseControllableStateOptions.defaultValue}.
	 *
	 * **Never alternate between passing and not passing this prop** for the
	 * same hook instance — switching modes after mount is flagged as an error
	 * in development the same way React flags it for `<input value>`.
	 *
	 * @remarks `null` is treated as a meaningful, defined value (i.e. still
	 * controlled) — only `undefined` means "uncontrolled." If your `T` is
	 * nullable, `value: null` is a legitimate controlled state, not an
	 * opt-out.
	 */
	value?: T;

	/**
	 * Initial value used **only** in uncontrolled mode (i.e., when
	 * {@link UseControllableStateOptions.value} is `undefined`).
	 *
	 * @remarks
	 * Mirrors the `defaultValue` pattern of native HTML elements
	 * (e.g. `<input defaultValue="..." />`). It is read exactly once — at
	 * mount — so later changes to this prop have no effect.
	 *
	 * @remarks Only `undefined` is treated as "not provided." If `T` allows
	 * `null`, `defaultValue: null` is honored as-is and will NOT fall back to
	 * {@link UseControllableStateOptions.fallbackValue}.
	 */
	defaultValue?: T;

	/**
	 * Callback fired whenever the internal dispatcher would change the value.
	 *
	 * @remarks
	 * - In **controlled mode** this is the *only* way state changes propagate:
	 *   the hook itself does not hold state, so the parent **must** update its
	 *   own state here to cause a re-render with the new value.
	 * - In **uncontrolled mode** the hook updates its own internal state
	 *   first, then fires this callback for side-effects or external
	 *   synchronization (analytics, persistence, etc.).
	 *
	 * The argument is always the **resolved next value**, never a functional
	 * updater — even if the dispatcher was called with one.
	 *
	 * @remarks Does **not** fire for a no-op dispatch — i.e. when the resolved
	 * next value is `Object.is`-equal to the current value. This mirrors the
	 * hook's re-render bail-out: no actual change means no notification.
	 */
	onChange?: (value: T) => void;

	/**
	 * Fallback to use when both {@link UseControllableStateOptions.value} (in
	 * controlled mode) and {@link UseControllableStateOptions.defaultValue}
	 * are `undefined`.
	 *
	 * @remarks
	 * Providing this prevents the hook from ever returning `undefined` and
	 * removes the need for downstream consumers to null-check the state value
	 * — **including inside functional updaters**: with `fallbackValue` set,
	 * `useControllableState` resolves to the overload where a functional
	 * updater's `prev` argument is typed as `T`, not `T | undefined`.
	 *
	 * If omitted, the hook may return `undefined`, which is reflected both in
	 * the returned value's type (`T | undefined`) AND in the functional
	 * updater's `prev` type (also `T | undefined`) — you must handle that case
	 * yourself, since it can happen for real (e.g. uncontrolled with no
	 * `defaultValue`, before the first dispatch).
	 */
	fallbackValue?: T;

	/**
	 * Human-readable name of the hook or component consuming
	 * `useControllableState`.
	 *
	 * @remarks
	 * Used exclusively in development-mode warnings and errors to produce
	 * actionable, component-specific messages instead of generic ones.
	 * Has no effect in production.
	 *
	 * @defaultValue `"useControllableState"`
	 */
	hookName?: string;
}

export type { ControllableDispatch, UseControllableStateOptions };
