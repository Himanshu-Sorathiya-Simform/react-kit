/**
 * The keyboard event types `useKey` accepts for `eventType`.
 *
 * `"keypress"` is included for backwards compatibility, but it's a
 * deprecated DOM event with inconsistent behavior for non-printable keys —
 * prefer `"keydown"` or `"keyup"` in new code.
 */
const validKeyEventTypes = ["keydown", "keyup", "keypress"] as const;

/**
 * `<input>` `type` values that don't accept typed text — `ignoreWhenFocusedInInputs`
 * only guards actual text-entry surfaces, so a shortcut like `Escape` or
 * `Cmd+S` still fires while, say, a checkbox or color swatch happens to be
 * focused.
 */
const NON_TEXT_INPUT_TYPES = new Set([
	"button",
	"checkbox",
	"color",
	"file",
	"hidden",
	"image",
	"radio",
	"range",
	"reset",
	"submit",
]);

export { NON_TEXT_INPUT_TYPES, validKeyEventTypes };
