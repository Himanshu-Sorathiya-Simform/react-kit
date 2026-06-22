import { useContext } from "react";
import { ModalContext } from "../context/ModalContext";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface UseModalReturn<TData> {
	id: string | null;
	data: TData | undefined;
	openModal: <T = any>(id: string, data?: T) => void;
	closeModal: () => void;
}

function useModal<TData = any>(): UseModalReturn<TData> {
	const context = useContext(ModalContext);

	if (!context) {
		throw new Error("useModal must be used within a ModalProvider");
	}

	return context as UseModalReturn<TData>;
}

export { type UseModalReturn, useModal };
