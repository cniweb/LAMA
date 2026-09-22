import { ExternalLink, Info, X } from 'lucide-react';
import type React from 'react';
import frontendPkg from '../../package.json';
import { useModalDialog } from '../hooks/useModalDialog.js';

interface VersionInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionInfoModal: React.FC<VersionInfoModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="version-modal-title"
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Version schließen"
          className="absolute top-5 right-5 p-1.5 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Info className="w-6 h-6 text-amber-400" />
          <h2 id="version-modal-title" className="text-xl font-black text-amber-400">
            Über LAMA
          </h2>
        </div>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p className="font-bold text-slate-100">
            Version <span className="font-mono text-amber-300">v{frontendPkg.version}</span>
          </p>
          <p className="text-xs sm:text-sm">
            LAMA Online – Lege Alle Minuspunkte Ab! Echtzeit-Kartenspiel für 2–6 Spieler.
          </p>
          <a
            href="https://github.com/cniweb/LAMA/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-300 hover:text-amber-200 underline decoration-amber-400/50 underline-offset-2 transition"
          >
            <span>Changelog auf GitHub ansehen</span>
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
          </a>
          <p className="text-xs text-slate-500">
            Öffnet in einem neuen Fenster. Dort findest du alle Änderungen je Version.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition cursor-pointer"
        >
          Schließen
        </button>
      </div>
    </div>
  );
};

export default VersionInfoModal;
