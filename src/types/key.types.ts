import type { RefObject } from "react";
import type { validKeyEventTypes } from "../constants/keyConstants.ts";

type KeyEventType = (typeof validKeyEventTypes)[number];

interface BaseKeyOptions {
	enabled?: boolean;
	target?: RefObject<HTMLElement | null> | Window;
	preventDefault?: boolean;
	stopPropagation?: boolean;
	ignoreWhenFocusedInInputs?: boolean;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
}

type KeyOptions = BaseKeyOptions
	& (
		| { eventType?: "keydown" | "keypress"; preventRepeat?: boolean }
		| { eventType: "keyup"; preventRepeat?: never }
	);

export type { BaseKeyOptions, KeyEventType, KeyOptions };
