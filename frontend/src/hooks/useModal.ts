import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./useRedux";
import { openModal, closeModal } from "../store/slices/uiSlice";

export const useModal = (modalName: string) => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.ui.modals[modalName] ?? false);

  const open = useCallback(() => {
    dispatch(openModal(modalName));
  }, [dispatch, modalName]);

  const close = useCallback(() => {
    dispatch(closeModal(modalName));
  }, [dispatch, modalName]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
};
