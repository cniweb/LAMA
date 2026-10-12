import type { GameVariant } from '@lama/shared';
import { HelpCircle, X } from 'lucide-react';
import type React from 'react';
import { useModalDialog } from '../hooks/useModalDialog.js';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: GameVariant;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, variant = 'classic' }) => {
  const dialogRef = useModalDialog<HTMLDivElement>(isOpen, onClose);
  const isParty = variant === 'party';
  const isCrazy = variant === 'crazy';
  // Party & Crazy teilen Pluskarten, pinkes Lama und 20er-Chips.
  const hasPartyBase = isParty || isCrazy;

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
          className="absolute top-5 right-5 p-1.5 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <HelpCircle className="w-6 h-6 text-amber-400" />
          <h2 id="rules-modal-title" className="text-xl sm:text-2xl font-black text-amber-400">
            LAMA Spielregeln
          </h2>
          <span
            className={`ml-1 text-xs px-2 py-0.5 rounded-full font-bold border ${
              isCrazy
                ? 'bg-amber-400/20 border-yellow-500/50 text-yellow-300'
                : isParty
                  ? 'bg-pink-500/20 border-pink-400/50 text-pink-300'
                  : 'bg-slate-800 border-slate-600 text-slate-300'
            }`}
          >
            {isCrazy ? '🦙✨ Crazy' : isParty ? '🎉 Party' : '🦙 Klassik'}
          </span>
        </div>
        <p className="text-[11px] font-bold tracking-wider uppercase text-slate-500 mb-4">
          {isCrazy
            ? 'Crazy Edition – goldenes Lama & Aktionskarten'
            : isParty
              ? 'Party Edition – Pluskarten, pinkes Lama & 20er-Chips'
              : 'Klassik – 1–6 & Lama'}
        </p>

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
              🎴 Spiel-Utensilien ({isCrazy ? 'Crazy' : isParty ? 'Party' : 'Klassik'})
            </h3>
            {isCrazy ? (
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>63 Karten:</strong> je 7× 1–6, 6× Pluskarten (`1+`–`6+`), 7× Lama, 1×{' '}
                  <strong className="text-pink-300">pinkes Lama</strong>, 1×{' '}
                  <strong className="text-yellow-300">goldenes Lama</strong>, je 2× Skip, Zieh 2 &
                  Gift.
                </li>
                <li>
                  <strong>Chips:</strong> weiß 1, schwarz 10,{' '}
                  <strong className="text-pink-300">pink 20</strong> (Tausch: 10 weiß → schwarz, 2
                  schwarz → pink).
                </li>
              </ul>
            ) : isParty ? (
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>56 Karten:</strong> je 7× 1–6, 6× Pluskarten (`1+`–`6+`), 7× Lama, 1×{' '}
                  <strong className="text-pink-300">pinkes Lama</strong> (Joker).
                </li>
                <li>
                  <strong>Chips:</strong> weiß 1, schwarz 10,{' '}
                  <strong className="text-pink-300">pink 20</strong> (Tausch: 10 weiß → schwarz, 2
                  schwarz → pink).
                </li>
              </ul>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>56 Karten:</strong> je 8× 1–6, 8× Lama.
                </li>
                <li>
                  <strong>70 Chips:</strong> 50× weiß (1), 20× schwarz (10) – 10 weiß → schwarz
                  tauschbar.
                </li>
              </ul>
            )}
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
                {hasPartyBase && (
                  <>
                    {' '}
                    <br />
                    <em>{isCrazy ? 'Party-Mix:' : 'Party:'}</em>{' '}
                    <strong className="text-pink-300">Pinkes Lama (PL)</strong> passt als Joker{' '}
                    <strong>auf jede Karte</strong>. Auf PL darf nur <strong>Lama</strong> oder{' '}
                    <strong>1</strong> (auch `1+` zählt als 1) gelegt werden.{' '}
                    <strong>Pluskarte</strong> (`3+`) wird wie ihre Zahl gelegt und gibt sofort
                    einen <strong>Extra-Zug</strong>.
                  </>
                )}
                {isCrazy && (
                  <>
                    {' '}
                    <br />
                    <em>Crazy:</em> <strong className="text-yellow-300">Goldenes Lama (GL)</strong>{' '}
                    passt als Joker auf jede Karte; danach startet der Ablagestapel frei neu
                    (beliebige Folgekarte). Die Aktionskarten <strong>Skip</strong>,{' '}
                    <strong>Zieh 2</strong> und <strong>Gift</strong> sind ebenfalls immer legbar
                    und erlauben als oberste Karte eine beliebige Folgekarte.
                  </>
                )}
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
              {hasPartyBase && ' Im Solo zählt jeder Kartenwert-plus nur einmal (PL/GL als Lama).'}
              {isCrazy && ' Draw-Two verpufft im Solo (kein Mitspieler zum Ziehen).'}
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
              {hasPartyBase && (
                <>
                  {' '}
                  Pinkes Lama dabei = <strong className="text-pink-300">20</strong> für alle Lamas.
                  Pluskarten zählen als ihr Basiswert (`3+` → 3).
                </>
              )}
              {isCrazy && (
                <>
                  {' '}
                  Goldenes Lama = <strong className="text-yellow-300">30</strong> (höchste
                  Lama-Stufe gewinnt: GL 30 &gt; PL 20 &gt; L 10). Skip, Zieh 2 & Gift zählen 0.
                </>
              )}
            </p>
          </section>

          <section>
            <h3 className="font-extrabold text-slate-100 text-sm sm:text-base mb-1">
              🌟 Chip-Bonus & Spielende
            </h3>
            <p>
              Wer alle Karten abgelegt hat, darf einen beliebigen Chip
              {hasPartyBase ? ' (auch pinken 20er!)' : ' (auch schwarzen 10er!)'} abgeben. Erreicht
              jemand <strong>40 Minuspunkte</strong>, endet das Spiel und wer am wenigsten Punkte
              hat, gewinnt!
            </p>
          </section>

          {isParty && (
            <section>
              <h3 className="font-extrabold text-pink-300 text-sm sm:text-base mb-1">
                🎉 Party Edition: Pluskarten, pinkes Lama & 20er-Chips
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Pluskarte (z. B. 3+):</strong> wird wie ihr Zahlenwert gelegt. Danach bist
                  du <strong>sofort nochmal am Zug</strong> (ablegen, ziehen oder aussteigen).
                </li>
                <li>
                  <strong>Pinkes Lama:</strong> passt als Joker <strong>auf jede Karte</strong>.
                  Darauf darf nur ein <strong>Lama</strong> oder eine <strong>1</strong> gelegt
                  werden.
                </li>
                <li>
                  <strong>Wertung:</strong> Pluskarten zählen als ihr Basiswert (nur 1×). Lamas mit
                  pinkem Lama dabei zählen <strong>20</strong> statt 10.
                </li>
                <li>
                  <strong>Chips:</strong> zusätzlich pinke <strong>20er</strong>. Tausch: 10× weiß →
                  schwarz, 2× schwarz → pink. Bonus bei leerer Hand: 1er, 10er oder 20er abgeben.
                </li>
              </ul>
            </section>
          )}

          {isCrazy && (
            <section>
              <h3 className="font-extrabold text-yellow-300 text-sm sm:text-base mb-1">
                🦙✨ Crazy Edition: goldenes Lama & Aktionskarten
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong className="text-yellow-300">Goldenes Lama (GL):</strong> Joker auf jede
                  Karte. Als oberste Karte <strong>Reset</strong> – die nächste Karte darf beliebig
                  sein. In der Wertung <strong>30 Minuspunkte</strong>; innerhalb der Lama-Gruppe
                  zählt nur die höchste Stufe (GL 30 &gt; PL 20 &gt; L 10, nur einmal).
                </li>
                <li>
                  <strong>Skip:</strong> der nächste aktive Spieler wird übersprungen.
                </li>
                <li>
                  <strong>Zieh 2 (Draw-Two):</strong> der nächste aktive Spieler zieht bis zu 2
                  Karten (so viele wie möglich) und setzt aus. Im Solo verpufft die Aktion.
                </li>
                <li>
                  <strong>Gift:</strong> deine höchste Handkarte geht automatisch an den aktiven
                  Spieler mit den wenigsten Karten.
                </li>
                <li>
                  Alle drei Aktionskarten sind <strong>immer legbar</strong>, zählen{' '}
                  <strong>0 Minuspunkte</strong> und erlauben als oberste Karte eine beliebige
                  Folgekarte. Pluskarten, pinkes Lama und 20er-Chips wie in der Party Edition.
                </li>
              </ul>
            </section>
          )}
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
