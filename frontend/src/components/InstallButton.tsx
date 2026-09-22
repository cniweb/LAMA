import { Download, Share, X } from 'lucide-react';
import { useState } from 'react';
import { useModalDialog } from '../hooks/useModalDialog.js';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

export function InstallButton({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
  const { isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [showFallbackHint, setShowFallbackHint] = useState(false);
  const dialogRef = useModalDialog<HTMLDivElement>(showIOSHint || showFallbackHint, () => {
    setShowIOSHint(false);
    setShowFallbackHint(false);
  });

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSHint(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'unavailable') {
      setShowFallbackHint(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          variant === 'full'
            ? 'w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer'
            : 'p-1.5 min-w-11 min-h-11 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition cursor-pointer'
        }
        title="App installieren"
        aria-label="App installieren"
        data-testid="pwa-install-button"
      >
        <Download className="w-4 h-4" />
        {variant === 'full' ? <span>App installieren</span> : null}
      </button>

      {(showIOSHint || showFallbackHint) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl outline-none"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2
                id="pwa-install-title"
                className="text-sm font-black text-slate-100 flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-amber-400" />
                App installieren
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowIOSHint(false);
                  setShowFallbackHint(false);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showIOSHint ? (
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p className="font-bold text-slate-100">Auf iPhone / iPad:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li className="flex items-start gap-1.5">
                    <Share className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                    <span>
                      Tippe unten auf <span className="font-bold">Teilen</span> (Quadrat mit Pfeil).
                    </span>
                  </li>
                  <li>
                    Wähle <span className="font-bold text-slate-100">„Zum Home-Bildschirm“</span>.
                  </li>
                  <li>
                    Bestätige mit <span className="font-bold text-slate-100">Hinzufügen</span> –
                    LAMA erscheint wie eine native App auf deinem Startbildschirm.
                  </li>
                </ol>
                <p className="text-xs text-slate-400">
                  Tipp: Auf dem Desktop findest du „Installieren“ im Browser-Menü (⁝) oder in der
                  Adressleiste.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p>
                  Dein Browser unterstützt keinen direkten Installations-Dialog. Du kannst LAMA
                  trotzdem installieren:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <span className="font-bold text-slate-100">Chrome / Edge (Desktop):</span> Menü{' '}
                    <span className="font-mono">⋮</span> →{' '}
                    <span className="font-bold">App installieren</span> oder Icon in der
                    Adressleiste.
                  </li>
                  <li>
                    <span className="font-bold text-slate-100">Chrome (Android):</span> Menü{' '}
                    <span className="font-mono">⋮</span> →{' '}
                    <span className="font-bold">Zum Startbildschirm hinzufügen</span>.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Share className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-bold text-slate-100">Safari (iOS):</span> Teilen → Zum
                      Home-Bildschirm.
                    </span>
                  </li>
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowIOSHint(false);
                setShowFallbackHint(false);
              }}
              className="mt-4 w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm transition cursor-pointer"
            >
              Verstanden
            </button>
          </div>
        </div>
      )}
    </>
  );
}
