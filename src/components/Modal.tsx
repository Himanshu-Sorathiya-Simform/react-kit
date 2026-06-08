import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useModal } from "../hooks/useModal.ts";

import "../css/Modal.css";

interface ModalProps {
	children: React.ReactNode;
	className?: string;
}

function Modal({ children, className = "" }: ModalProps) {
	const { id, closeModal } = useModal();

	const dialogRef = useRef<HTMLDialogElement | null>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (id && !dialog.open) {
			dialog.showModal();
		} else if (!id && dialog.open) {
			dialog.close();
		}
	}, [id]);

	const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
		event.preventDefault();

		closeModal();
	};

	return createPortal(
		<dialog
			ref={dialogRef}
			onCancel={handleCancel}
			className={`universal-modal ${className ?? ""}`}
		>
			<div className="modal-container">{children}</div>
		</dialog>,
		document.body,
	);
}

export { Modal };
