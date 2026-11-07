"use client";

import { useState, useEffect, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
  prompt(): Promise<void>;
}

export default function PwaInstallPrompt() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      setIsStandalone(standalone);
    };

    const checkDismissed = () => {
      const dismissedTime = localStorage.getItem("radiofr_pwa_dismissed");
      if (dismissedTime) {
        const dismissedDate = new Date(parseInt(dismissedTime));
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - dismissedDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setIsDismissed(diffDays < 7);
      }
    };

    const checkIOS = () => {
      setIsIOS(/iP(hone|ad|od)/i.test(navigator.userAgent));
    };

    checkStandalone();
    checkDismissed();
    checkIOS();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (!isStandalone && !isDismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (isIOS && !isStandalone && !isDismissed) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isStandalone, isDismissed, isIOS]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSSheet(true);
    } else if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      deferredPrompt.current = null;
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("radiofr_pwa_dismissed", Date.now().toString());
    setShowPrompt(false);
    setShowIOSSheet(false);
  };

  if (isStandalone || isDismissed || !showPrompt) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-24 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-40">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3.5 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 15V9C4 5.68629 6.68629 3 10 3H14C17.3137 3 20 5.68629 20 9V15C20 18.3137 17.3137 21 14 21H10C6.68629 21 4 18.3137 4 15Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15V21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 13H16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 17H16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-medium text-white truncate">Installer RadioFR</h3>
              <p className="text-sm text-slate-400 mt-0.5">Accès instantané sans navigateur</p>
            </div>
            <button
              onClick={handleInstallClick}
              className="flex-shrink-0 min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Installer
            </button>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showIOSSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleDismiss}
          ></div>
          <div className="relative w-full max-w-md bg-slate-900 border-t border-slate-700 rounded-t-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-white">Installer sur votre iPhone</h3>
              <button
                onClick={handleDismiss}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12V16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 12L14 14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 12L10 14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white">1. Touchez l'icône Partager</h4>
                  <p className="text-sm text-slate-400 mt-1">En bas de l'écran, au centre.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2V12M12 12V22M12 12H2M12 12H22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white">2. Choisissez "Sur l'écran d'accueil"</h4>
                  <p className="text-sm text-slate-400 mt-1">Dans le menu qui s'affiche.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 stroke-current" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2V12M12 12V22M12 12H2M12 12H22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white">3. Touchez "Ajouter"</h4>
                  <p className="text-sm text-slate-400 mt-1">En haut à droite.</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="mt-6 w-full min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Terminé / Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}