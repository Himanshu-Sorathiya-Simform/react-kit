import {
	type CSSProperties,
	type MouseEventHandler,
	type SyntheticEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { useModalActions, useModalState } from "./useModal.ts";

interface ModalLayoutProps {
	modalId: string;
	children: React.ReactNode;
	wrapperClassName?: string;
	wrapperStyle?: CSSProperties;
	containerClassName?: string;
	containerStyle?: CSSProperties;
}

function ModalLayout({
	modalId,
	children,
	wrapperClassName = "",
	wrapperStyle,
	containerClassName = "",
	containerStyle,
}: ModalLayoutProps) {
	const { isOpen, id } = useModalState();
	const { closeModal, clearModal } = useModalActions();
	const [isClosing, setIsClosing] = useState(false);

	const dialogRef = useRef<HTMLDialogElement | null>(null);

	const isCurrentModal = id === modalId;
	const shouldBeOpen = isOpen && isCurrentModal;

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (shouldBeOpen && !dialog.open) {
			setIsClosing(false);

			dialog.showModal();
		} else if (!shouldBeOpen && dialog.open) {
			setIsClosing(true);
		}
	}, [shouldBeOpen]);

	const handleAnimationEnd = () => {
		if (isClosing) {
			const dialog = dialogRef.current;

			if (dialog) {
				dialog.close();
			}

			setIsClosing(false);

			if (isCurrentModal) clearModal();
		}
	};

	const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
		event.preventDefault();

		closeModal();
	};

	const handleClickOutside: MouseEventHandler<HTMLDialogElement> = (event) => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		const dialogRect = dialog.getBoundingClientRect();

		if (
			event.clientX < dialogRect.x
			|| event.clientX > dialogRect.x + dialogRect.width
			|| event.clientY < dialogRect.y
			|| event.clientY > dialogRect.y + dialogRect.height
		) {
			closeModal();
		}
	};

	if (typeof document === "undefined") return null;

	if (!isCurrentModal && !isClosing) return null;

	return createPortal(
		<dialog
			ref={dialogRef}
			onCancel={handleCancel}
			onClose={closeModal}
			onClick={handleClickOutside}
			onAnimationEnd={handleAnimationEnd}
			className={`universal-modal ${wrapperClassName}`.trim()}
			style={wrapperStyle}
		>
			<div
				className={`modal-container ${containerClassName}`.trim()}
				style={containerStyle}
			>
				{children}
			</div>
		</dialog>,
		document.body,
	);
}

export { type ModalLayoutProps, ModalLayout };
