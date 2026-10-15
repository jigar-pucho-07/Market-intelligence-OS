import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip } from 'antd';
import { useT } from '../i18n';
import { D, E, prefersReducedMotion } from '../config/motion';

export default function Modal({ isOpen, onClose, title, children, size = 'md', showClose = true }) {
  const t = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Escape closes the top-most panel; an open antd dropdown inside takes the first Escape itself.
  useEffect(() => {
    if (!isOpen) return;
    const on = (e) => { if (e.key === 'Escape' && !document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown:not(.ant-picker-dropdown-hidden)')) onClose?.(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [isOpen, onClose]);

  // The panel owns the width; a form inside is w-full, so fields are centred in the panel with the
  // label and input both starting at the panel's left padding (never wider than the panel).
  const sizeClasses = {
    sm: 'w-full sm:w-[400px]',
    md: 'w-full sm:w-[520px]',
    lg: 'w-full sm:w-[760px]',
    xl: 'w-full sm:w-[960px]',
    full: 'w-full sm:w-[1120px]',
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      {(
        <motion.div
          key="modal-root"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: D.QUICK }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: D.QUICK }}
            className="absolute inset-0 bg-black/25"
            onClick={onClose}
          />
          <motion.div
            initial={prefersReducedMotion() ? { opacity: 1 } : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: D.BASE, ease: E.OUT }}
            data-modal-panel role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            className={cn(
              'relative bg-white rounded-2xl shadow-overlay border border-[color:var(--hair-5)] max-w-[calc(100vw-2rem)] m-4 p-5 sm:p-7',
              'flex flex-col gap-5 font-sans',
              'max-h-[90vh] overflow-y-auto overflow-x-hidden',
              sizeClasses[size]
            )}
          >
            {(title || showClose) && (
              <div className="flex items-center justify-between">
                {title && <h2 className="text-[19px] font-semibold text-ink">{title}</h2>}
                {showClose && (
                  <Tooltip title={t('Close')}>
                    <button
                      onClick={onClose}
                      aria-label={t('Close')}
                      className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center shrink-0 -mr-2 sm:mr-0 rounded-full hover:bg-black/[0.04] transition-colors ml-auto"
                    >
                      <X className="w-5 h-5 text-ink-2" />
                    </button>
                  </Tooltip>
                )}
              </div>
            )}

            <div className="text-ink-2">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </>
  );

  if (!mounted) return null;

  return createPortal(modalContent, document.body);
}
