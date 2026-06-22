import { type ReactNode, createContext, useCallback, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ModalState {
	id: string | null;
	data: any;
}

interface ModalContextType extends ModalState {
	openModal: <T = any>(id: string, data?: T) => void;
	closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

function ModalProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<ModalState>({
		id: null,
		data: undefined,
	});

	const openModal = useCallback(<T = any,>(id: string, data?: T) => {
		setState({ id, data });
	}, []);

	const closeModal = useCallback(() => {
		setState({ id: null, data: undefined });
	}, []);

	return (
		<ModalContext.Provider
			value={{ id: state.id, data: state.data, openModal, closeModal }}
		>
			{children}
		</ModalContext.Provider>
	);
}

export { ModalContext, ModalProvider };
