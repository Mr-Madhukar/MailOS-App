"use client";

import { useEffect, useRef } from "react";

export function useModalBackdrop(
  isOpen: boolean,
  onClose: () => void,
  isBusy = false,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog && !isBusy) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) {
        onClose();
      }
    };

    dialog?.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      dialog?.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isBusy, onClose]);

  return dialogRef;
}
