import { useContext } from "react";
import { ModalActionContext, ModalStateContext } from "../context/ModalContext";

interface UseModalStateReturn<TData> {
	isOpen: boolean;
	id: string | null;
	data: TData | undefined;
}

interface UseModalActionsReturn {
	openModal: <T = unknown>(id: string, data?: T) => void;
	closeModal: () => void;
	clearModal: () => void;
}

function useModalState<TData = unknown>(): UseModalStateReturn<TData> {
	const context = useContext(ModalStateContext);

	if (!context) {
		throw new Error("useModalState must be used within a ModalProvider");
	}

	return context as UseModalStateReturn<TData>;
}

function useModalActions(): UseModalActionsReturn {
	const context = useContext(ModalActionContext);

	if (!context) {
		throw new Error("useModalActions must be used within a ModalProvider");
	}

	return context;
}

function useModal<TData = unknown>() {
	return {
		...useModalState<TData>(),
		...useModalActions(),
	};
}

export { useModal, useModalActions, useModalState };
