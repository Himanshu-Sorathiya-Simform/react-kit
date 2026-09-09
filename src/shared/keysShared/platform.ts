/**
 * The three platform families relevant to keyboard-shortcut conventions.
 * Only the mac/non-mac split affects *matching* (which physical modifier
 * `mod` resolves to) — the windows/linux split only matters for *display*
 * (e.g. "Win" vs "Super"), which is `formatKey`'s concern, not `useKey`'s.
 */
type Platform = "mac" | "windows" | "linux";

/**
 * Memoized result of {@link detectPlatform}, populated on first call. Never
 * set from the SSR fallback (see below), so a module instance that first
 * runs on the server and then gets reused during client hydration still
 * detects the real platform instead of getting stuck on `"windows"`.
 */
let cachedPlatform: Platform | null = null;

/**
 * Detects the current platform family. Prefers the modern
 * `navigator.userAgentData.platform` (currently Chromium-only) and falls
 * back to the deprecated but still universally-supported
 * `navigator.platform` / `navigator.userAgent`. Defaults to `"windows"`
 * when neither exists (SSR) — safe, since matching only checks mac-or-not.
 *
 * The result is cached after the first real (non-SSR) detection — the
 * platform a page is running on can't change mid-session, so there's no
 * reason to re-read `navigator` on every `useKey({ mod: true })` render or
 * `formatKey()` call.
 */
function detectPlatform(): Platform {
	if (cachedPlatform !== null) return cachedPlatform;

	if (typeof navigator === "undefined") return "windows";

	const uaData = (
		navigator as Navigator & { userAgentData?: { platform?: string } }
	).userAgentData;
	const source =
		uaData?.platform ?? navigator.platform ?? navigator.userAgent ?? "";
	const normalized = source.toLowerCase();

	if (
		normalized.includes("mac")
		|| normalized.includes("iphone")
		|| normalized.includes("ipad")
	) {
		cachedPlatform = "mac";
	} else if (normalized.includes("linux")) {
		cachedPlatform = "linux";
	} else {
		cachedPlatform = "windows";
	}

	return cachedPlatform;
}

/**
 * Resolves `mod` to the concrete physical modifier it stands for on the
 * current platform: Meta (Cmd) on mac, Control everywhere else.
 */
function resolveMod(platform: Platform = detectPlatform()): {
	ctrlKey: boolean;
	metaKey: boolean;
} {
	return platform === "mac" ?
			{ ctrlKey: false, metaKey: true }
		:	{ ctrlKey: true, metaKey: false };
}

export { detectPlatform, resolveMod, type Platform };
