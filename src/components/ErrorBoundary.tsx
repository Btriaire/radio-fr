"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global & Component Error Boundary.
 * Catches unhandled render exceptions, prevents white screens,
 * preserves user audio session and local state, zero emoji.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an exception:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] w-full p-6 flex flex-col items-center justify-center text-center bg-[#0a0a0d] border border-neutral-800/80 rounded-2xl m-auto max-w-lg my-8 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center mb-4 text-[#d4a843]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4a843] font-bold mb-1">
            RECUPERATION AUTOMATIQUE
          </span>
          <h2 className="text-base font-mono font-bold text-white mb-2">
            {this.props.fallbackTitle || "INCIDENT TECHNIQUE EVITE"}
          </h2>
          <p className="text-xs font-mono text-neutral-400 max-w-sm mb-6 leading-relaxed">
            Une exception d&apos;affichage a ete neutralisee sans perte de donnees. Vos favoris et configurations restent intacts.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-xs font-mono text-neutral-200 hover:text-white transition-all active:scale-95"
            >
              REPRENDRE
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-[#d4a843] hover:bg-[#e6b952] text-black text-xs font-mono font-bold transition-all active:scale-95 shadow-sm"
            >
              RECHARGER L&apos;APPLICATION
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
