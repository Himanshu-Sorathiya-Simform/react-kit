import { useCallback, useRef, useState } from "react";

type VisibilityId = string | number;

interface UseVisibilityReturn {
	visibleState: Map<VisibilityId, boolean>;
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

	const [visibleState, setVisibleState] = useState(() => {
		const map = new Map<VisibilityId, boolean>();

		initialIds.forEach((id) => {
			map.set(id, true);
		});

		return map;
	});

	const isVisible = useCallback(
		(id: VisibilityId) => !!visibleState.get(id),
		[visibleState],
	);

	const toggleVisibility = useCallback((id: VisibilityId) => {
		setVisibleState((prev) => {
			const next = new Map(prev);

			next.set(id, !next.get(id));

			return next;
		});
	}, []);

	const show = useCallback((id: VisibilityId) => {
		setVisibleState((prev) => {
			const next = new Map(prev);

			next.set(id, true);

			return next;
		});
	}, []);

	const hide = useCallback((id: VisibilityId) => {
		setVisibleState((prev) => {
			const next = new Map(prev);

			next.set(id, false);

			return next;
		});
	}, []);

	const showAll = useCallback((ids?: VisibilityId[]) => {
		setVisibleState((prev) => {
			const next = new Map(prev);

			const targetIds = ids ?? Array.from(next.keys());

			targetIds.forEach((id) => {
				next.set(id, true);
			});

			return next;
		});
	}, []);

	const hideAll = useCallback((ids?: VisibilityId[]) => {
		setVisibleState((prev) => {
			const next = new Map(prev);

			const targetIds = ids ?? Array.from(next.keys());

			targetIds.forEach((id) => {
				next.set(id, false);
			});

			return next;
		});
	}, []);

	const replaceVisibility = useCallback((newIds: VisibilityId[]) => {
		setVisibleState(() => {
			const map = new Map<VisibilityId, boolean>();

			newIds.forEach((id) => {
				map.set(id, true);
			});

			return map;
		});
	}, []);

	const resetVisibility = useCallback(() => {
		setVisibleState(() => {
			const map = new Map<VisibilityId, boolean>();

			initialIdsRef.current.forEach((id) => {
				map.set(id, true);
			});

			return map;
		});
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
