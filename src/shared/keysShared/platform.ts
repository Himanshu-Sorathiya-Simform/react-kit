/**
 * The three platform families relevant to keyboard-shortcut conventions.
 * Only the mac/non-mac split affects *matching* (which physical modifier
 * `mod` resolves to) — the windows/linux split only matters for *display*
 * (e.g. "Win" vs "Super"), which is `formatKey`'s concern, not `useKey`'s.
 */
type Platform = "mac" | "windows" | "linux";

/**
 * Detects the current platform family. Prefers the modern
 * `navigator.userAgentData.platform` (currently Chromium-only) and falls
 * back to the deprecated but still universally-supported
 * `navigator.platform` / `navigator.userAgent`. Defaults to `"windows"`
 * when neither exists (SSR) — safe, since matching only checks mac-or-not.
 */
function detectPlatform(): Platform {
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
		return "mac";
	}

	if (normalized.includes("linux")) return "linux";

	return "windows";
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
