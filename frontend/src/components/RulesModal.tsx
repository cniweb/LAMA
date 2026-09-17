import { HelpCircle, X } from 'lucide-react';
import type React from 'react';
import { useModalDialog } from '../hooks/useModalDialog.js';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Regeln schließen"
          className="absolute top-5 right-5 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-6 h-6 text-amber-400" />
          <h2 id="rules-modal-title" className="text-xl sm:text-2xl font-black text-amber-400">
            LAMA Spielregeln
          </h2>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <section>
            <h3 className="font-extrabold text-slate-100 text-sm sm:text-base mb-1">
              🎯 Das Prinzip: Lege Alle Minuspunkte Ab!
            </h3>
            <p>
              Ziel ist es, so schnell wie möglich alle Handkarten loszuwerden, um keine Minuspunkte
              zu kassieren.
            </p>
          </section>

          <section>
            <h3 className="font-extrabold text-slate-100 text-sm sm:text-base mb-1">
              🃏 Deine 3 Zug-Optionen
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Karte ablegen:</strong> Gleicher Wert oder genau +1 (z.B. 3 auf 3 oder 4 auf
                3).
                <br />
                <em>Sonderfälle:</em> Auf eine <strong>6</strong> darf eine 6 oder ein{' '}
                <strong>Lama</strong> gelegt werden. Auf ein <strong>Lama</strong> darf ein Lama
                oder eine <strong>1</strong> gelegt werden.
              </li>
              <li>
                <strong>Karte nachziehen:</strong> 1 Karte vom Nachziehstapel ziehen (Zug endet
                sofort). Wenn der Stapel leer ist, darf nicht mehr gezogen werden!
              </li>
              <li>
                <strong>Aussteigen (Passen):</strong> Handkarten verdeckt sichern. Für dich ist der
                Durchgang beendet.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-extrabold text-slate-100 text-sm sm:text-base mb-1">
              ⚡ Solo-Endspurt
            </h3>
            <p>
              Sind alle anderen Mitspieler ausgestiegen, spielst du alleine weiter. Du darfst jedoch{' '}
              <strong>nicht mehr nachziehen</strong>, sondern nur noch ablegen, solange du kannst
              und willst!
            </p>
          </section>

          <section>
            <h3 className="font-extrabold text-slate-100 text-sm sm:text-base mb-1">
              🔢 Abrechnung (Einmaligkeitsprinzip)
            </h3>
            <p>
              Jeder Kartenwert zählt nur <strong>einmal</strong> als Minuspunkte:
              <br />
              Drei 4er = 4 Minuspunkte. Lamas zählen 10 Minuspunkte.
            </p>
          </section>

          <section>
            <h3 className="font-extrabold text-slate-100 text-sm sm:text-base mb-1">
              🌟 Chip-Bonus & Spielende
            </h3>
            <p>
              Wer alle Karten abgelegt hat, darf einen beliebigen Chip (auch einen schwarzen 10er!)
              abgeben. Erreicht jemand <strong>40 Minuspunkte</strong>, endet das Spiel und wer am
              wenigsten Punkte hat, gewinnt!
            </p>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition cursor-pointer"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
};

export default RulesModal;
