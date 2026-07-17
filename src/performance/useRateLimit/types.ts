interface RateLimitOptions {
	onRateLimitReached?: () => void;
	refillStrategy?: "burst" | "gradual";
}

export type { RateLimitOptions };
