import { createStore } from "@tanstack/react-store";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ModalState {
	id: string | null;
	data: any;
}

interface ModalActions {
	[key: string]: any;
	open: <T = any>(id: string, data?: T) => void;
	close: () => void;
}

const modalStore = createStore<ModalState, ModalActions>(
	{
		id: null,
		data: undefined,
	},
	({ setState }): ModalActions => ({
		open: <T>(id: string, data?: T) =>
			setState((prev) => {
				return { ...prev, id, data };
			}),
		close: () =>
			setState((prev) => {
				return { ...prev, id: null, data: undefined };
			}),
	}),
);

export { modalStore };
