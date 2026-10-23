import type { CardValue, ChipCount, PlayerStatus } from '@lama/shared';
import { LogOut, PlusCircle } from 'lucide-react';
import type React from 'react';
import { Card } from './Card.js';
import { ChipExchangeControls } from './ChipExchangeControls.js';

interface PlayerHandProps {
  hand: CardValue[];
  chips: ChipCount;
  totalScore: number;
  status: PlayerStatus;
  isTurn: boolean;
  validPlays: CardValue[];
  canDraw: boolean;
  canFold: boolean;
  isSoloEndspurt: boolean;
  soloDiscardedValues?: CardValue[] | null;
  /** Varianten mit pinken 20er-Chips (Party & Crazy) zeigen den Pink-Tausch. */
  hasPinkChips?: boolean;
  exchangeAllowed: boolean;
  onPlayCard: (card: CardValue) => void;
  onDrawCard: () => void;
  onFold: () => void;
  onExchangeChips?: (from: 'white' | 'black') => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  hand,
  chips,
  totalScore,
  status,
  isTurn,
  validPlays,
  canDraw,
  canFold,
  isSoloEndspurt,
  soloDiscardedValues,
  hasPinkChips = false,
  exchangeAllowed,
  onPlayCard,
  onDrawCard,
  onFold,
  onExchangeChips,
}) => {
  const isFolded = status === 'FOLDED';

  return (
    <div className="w-full flex flex-col items-center gap-1 sm:gap-3 pb-[env(safe-area-inset-bottom)]">
      {/* Stabile Zwei-Zeilen-Steuerung: Chips/Tausch oben, Zugstatus unten. */}
      <div
        data-testid="controls-bar"
        className="flex h-[96px] w-full max-w-2xl flex-col gap-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 px-2 backdrop-blur-sm"
      >
        <div data-testid="chips-status-row" className="flex h-11 min-h-11 w-full items-center">
          <ChipExchangeControls
            chips={chips}
            totalScore={totalScore}
            hasPinkChips={hasPinkChips}
            exchangeAllowed={exchangeAllowed}
            onExchangeChips={onExchangeChips}
          />
        </div>

        <div
          data-testid="turn-status-row"
          className="flex h-11 min-h-11 w-full items-center justify-center gap-2"
        >
          {isTurn ? (
            <div className="flex min-w-0 items-center justify-center gap-1 sm:gap-2">
              <span
                data-testid="turn-indicator"
                className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-amber-500 px-2 sm:px-2.5 text-[10px] font-black uppercase tracking-wider text-slate-950 animate-pulse sm:text-xs"
              >
                Du bist am Zug!
              </span>
              {canFold && (
                <button
                  type="button"
                  onClick={onFold}
                  data-testid="fold-button"
                  className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-rose-600/80 px-2 text-[10px] font-bold whitespace-nowrap text-rose-100 shadow-md transition-colors hover:bg-rose-600 sm:gap-1.5 sm:px-3 sm:text-xs"
                  title="Aus dem Durchgang aussteigen und aktuelle Handkarten verdeckt sichern"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Aussteigen</span>
                </button>
              )}
              {canDraw && (
                <button
                  type="button"
                  onClick={onDrawCard}
                  data-testid="draw-button"
                  className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-blue-600/80 px-2 text-[10px] font-bold whitespace-nowrap text-blue-100 shadow-md transition-colors hover:bg-blue-600 sm:gap-1.5 sm:px-3 sm:text-xs"
                  title="1 Karte vom Nachziehstapel ziehen"
                >
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Ziehen</span>
                </button>
              )}
            </div>
          ) : isFolded ? (
            <span className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-slate-800 px-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              Du bist ausgestiegen
            </span>
          ) : (
            <span className="inline-flex h-11 shrink-0 items-center whitespace-nowrap text-xs font-semibold text-slate-400">
              Warten auf Mitspieler...
            </span>
          )}
        </div>
      </div>

      {/* Solo Endspurt Notice */}
      {isTurn && isSoloEndspurt && (
        <div className="text-[11px] sm:text-xs font-extrabold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-bounce">
          ⚡ Solo-Endspurt! Kein Nachziehen, jeder Wert nur 1× ablegbar!
          {soloDiscardedValues && soloDiscardedValues.length > 0 && (
            <span> Bereits gelegt: {soloDiscardedValues.join(', ')}</span>
          )}
        </div>
      )}

      {/* Hand Cards Fan */}
      <div
        data-testid="player-hand"
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-1 sm:py-2 px-2 max-w-4xl min-h-[92px] sm:min-h-[140px]"
      >
        {isFolded ? (
          <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40 text-slate-400">
            <span className="font-bold text-sm">Deine Karten liegen verdeckt vor dir.</span>
            <span className="text-xs mt-0.5 text-slate-500">
              Sie werden bei der Rundenabrechnung gewertet.
            </span>
          </div>
        ) : hand.length === 0 ? (
          <div className="text-sm font-bold text-emerald-400 animate-pulse">
            Keine Karten mehr – Runde gewonnen!
          </div>
        ) : (
          hand.map((card, idx) => {
            const isPlayable = isTurn && validPlays.includes(card);
            return (
              <div key={`${card}-${idx}`} className="transition-transform duration-150">
                <Card
                  value={card}
                  playable={isPlayable}
                  disabled={isTurn && !isPlayable}
                  size="xs"
                  onPlay={onPlayCard}
                  className="sm:w-20 sm:h-32 sm:text-2xl sm:rounded-xl sm:border-4"
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
