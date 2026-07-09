import { type ReactNode, createContext, useCallback, useState } from "react";

interface ModalState {
	isOpen: boolean;
	id: string | null;
	data: unknown;
}

interface ModalActionState {
	openModal: <T>(id: string, data?: T) => void;
	closeModal: () => void;
	clearModal: () => void;
}

const ModalStateContext = createContext<ModalState | null>(null);
const ModalActionContext = createContext<ModalActionState | null>(null);

function ModalProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<ModalState>({
		isOpen: false,
		id: null,
		data: undefined,
	});

	const openModal = useCallback(<T,>(id: string, data?: T) => {
		if (typeof id !== "string") {
			throw new Error(
				`[ModalContext] Invalid 'id' passed to openModal. Expected a string, but received: ${typeof id}.`,
			);
		}

		setState({ isOpen: true, id, data });
	}, []);

	const closeModal = useCallback(() => {
		setState((prev) => ({ ...prev, isOpen: false }));
	}, []);

	const clearModal = useCallback(() => {
		setState({ isOpen: false, id: null, data: undefined });
	}, []);

	return (
		<ModalStateContext.Provider
			value={{ isOpen: state.isOpen, id: state.id, data: state.data }}
		>
			<ModalActionContext.Provider
				value={{ openModal, closeModal, clearModal }}
			>
				{children}
			</ModalActionContext.Provider>
		</ModalStateContext.Provider>
	);
}

export { ModalActionContext, ModalProvider, ModalStateContext };
