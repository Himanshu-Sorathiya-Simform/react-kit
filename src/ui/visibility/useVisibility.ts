import { useCallback, useRef, useState } from "react";

type VisibilityId = string | number;

interface UseVisibilityReturn {
	visibleState: Set<VisibilityId>;
	isVisible: (id: VisibilityId) => boolean;
	toggleVisibility: (id: VisibilityId) => void;
	show: (id: VisibilityId) => void;
	hide: (id: VisibilityId) => void;
	showAll: (ids?: VisibilityId[]) => void;
	hideAll: (ids?: VisibilityId[]) => void;
	replaceVisibility: (newIds: VisibilityId[]) => void;
	resetVisibility: () => void;
}

function useVisibility(initialIds: VisibilityId[]): UseVisibilityReturn {
	const initialIdsRef = useRef(initialIds);

	const [visibleState, setVisibleState] = useState(
		() => new Set<VisibilityId>(initialIds),
	);

	const isVisible = useCallback(
		(id: VisibilityId) => visibleState.has(id),
		[visibleState],
	);

	const toggleVisibility = useCallback((id: VisibilityId) => {
		setVisibleState((prev) => {
			const next = new Set(prev);

			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}

			return next;
		});
	}, []);

	const show = useCallback((id: VisibilityId) => {
		setVisibleState((prev) => {
			const next = new Set(prev);

			next.add(id);

			return next;
		});
	}, []);

	const hide = useCallback((id: VisibilityId) => {
		setVisibleState((prev) => {
			const next = new Set(prev);

			next.delete(id);

			return next;
		});
	}, []);

	const showAll = useCallback((ids?: VisibilityId[]) => {
		setVisibleState((prev) => {
			const next = new Set(prev);
			const targetIds = ids ?? Array.from(next.keys());

			targetIds.forEach((id) => {
				next.add(id);
			});

			return next;
		});
	}, []);

	const hideAll = useCallback((ids?: VisibilityId[]) => {
		setVisibleState((prev) => {
			const next = new Set(prev);
			const targetIds = ids ?? Array.from(next.keys());

			targetIds.forEach((id) => {
				next.delete(id);
			});

			return next;
		});
	}, []);

	const replaceVisibility = useCallback((newIds: VisibilityId[]) => {
		setVisibleState(() => new Set(newIds));
	}, []);

	const resetVisibility = useCallback(() => {
		setVisibleState(() => new Set(initialIdsRef.current));
	}, []);

	return {
		visibleState,
		isVisible,
		toggleVisibility,
		show,
		hide,
		showAll,
		hideAll,
		replaceVisibility,
		resetVisibility,
	};
}

export { type UseVisibilityReturn, useVisibility };
