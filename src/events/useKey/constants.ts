/**
 * The keyboard event types `useKey` accepts for `eventType`.
 *
 * `"keypress"` is included for backwards compatibility, but it's a
 * deprecated DOM event with inconsistent behavior for non-printable keys —
 * prefer `"keydown"` or `"keyup"` in new code.
 */
const validKeyEventTypes = ["keydown", "keyup", "keypress"] as const;

export { validKeyEventTypes };
