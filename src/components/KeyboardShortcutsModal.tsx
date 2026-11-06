'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg glass-dark border border-white/15 rounded-3xl p-6 shadow-2xl text-white space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Raccourcis Clavier</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Lecture & Transport</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      Espace
                    </kbd>
                    <span className="ml-2">: Lecture / Pause</span>
                  </li>
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      →
                    </kbd>
                    <span className="ml-2">: Station suivante (+30s)</span>
                  </li>
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      ←
                    </kbd>
                    <span className="ml-2">: Station précédente (-15s)</span>
                  </li>
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      J
                    </kbd>
                    <span className="ml-1">/</span>
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm ml-1">
                      L
                    </kbd>
                    <span className="ml-2">: Saut rapide -15s / +30s</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Volume & Traitement Hi-Fi</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      M
                    </kbd>
                    <span className="ml-2">: Activer / Couper le son (Mute)</span>
                  </li>
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      ↑
                    </kbd>
                    <span className="ml-1">/</span>
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm ml-1">
                      ↓
                    </kbd>
                    <span className="ml-2">: Ajuster le volume (+/- 5%)</span>
                  </li>
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      N
                    </kbd>
                    <span className="ml-2">: Mode Nuit (Compresseur dynamique)</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Navigation & Actions</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      F
                    </kbd>
                    <span className="ml-2">: Ajouter la station aux favoris</span>
                  </li>
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      ?
                    </kbd>
                    <span className="ml-1">ou</span>
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm ml-1">
                      H
                    </kbd>
                    <span className="ml-2">: Afficher cette aide</span>
                  </li>
                  <li className="flex items-center">
                    <kbd className="px-2 py-1 rounded-lg bg-white/10 border border-white/20 font-mono text-xs font-semibold text-white/90 shadow-sm">
                      Echap
                    </kbd>
                    <span className="ml-2">: Fermer les fenêtres</span>
                  </li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-white/40 pt-2 border-t border-white/10">
              Astuce : Les raccourcis sont actifs dès lors qu aucun champ texte n est sélectionné.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KeyboardShortcutsModal;