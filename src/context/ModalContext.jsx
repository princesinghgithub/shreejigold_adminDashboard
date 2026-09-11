import { createContext, useContext, useState } from 'react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [content, setContent] = useState(null);
  const [wide, setWide] = useState(false);
  const [open, setOpen] = useState(false);

  function openModal(node, isWide = false) {
    setContent(() => node);
    setWide(isWide);
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
    setContent(null);
  }

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <div className={'modal-bg' + (open ? ' show' : '')} onClick={(e) => { if (e.target.classList.contains('modal-bg')) closeModal(); }}>
        <div className={'modal' + (wide ? ' wide' : '')}>{content}</div>
      </div>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
