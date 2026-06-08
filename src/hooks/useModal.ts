import { useSelector } from "@tanstack/react-store";
import { modalStore } from "../store/modalStore.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UseModalReturn<TData> {
	id: string | null;
	data: TData | undefined;
	openModal: <T = any>(id: string, data?: T) => void;
	closeModal: () => void;
}

function useModal<TData = any>(): UseModalReturn<TData> {
	const id = useSelector(modalStore, (state) => state.id);
	const data = useSelector(modalStore, (state) => state.data);

	return {
		id,
		data,
		openModal: modalStore.actions.open,
		closeModal: modalStore.actions.close,
	};
}

export { type UseModalReturn, useModal };
