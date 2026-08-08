import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0A0A0F]/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#12121A] border border-[#2A2A40] rounded-2xl p-6 shadow-2xl z-10 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#2A2A40] pb-3">
              <h3 className="font-['Syne'] font-bold text-lg text-[#F0F0FF]">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-[#8888AA] hover:text-[#F0F0FF] hover:bg-[#1C1C2E] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
