import type { CardValue, ChipCount, PlayerStatus } from '@lama/shared';
import { LogOut, PlusCircle } from 'lucide-react';
import type React from 'react';
import { Card } from './Card.js';
import { ChipDisplay } from './ChipDisplay.js';

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
  onPlayCard: (card: CardValue) => void;
  onDrawCard: () => void;
  onFold: () => void;
  onExchangeChips?: () => void;
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
  onPlayCard,
  onDrawCard,
  onFold,
  onExchangeChips,
}) => {
  const isFolded = status === 'FOLDED';

  return (
    <div className="w-full flex flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)]">
      {/* Turn Action Controls Header */}
      <div className="flex flex-col gap-1 sm:gap-2 sm:flex-row sm:items-center sm:justify-between w-full max-w-2xl px-3 sm:px-4 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-extrabold text-slate-300">Deine Chips:</span>
          <ChipDisplay chips={chips} totalScore={totalScore} size="sm" />
          {onExchangeChips && chips.white >= 10 && (
            <button
              type="button"
              onClick={onExchangeChips}
              data-testid="exchange-chips-button"
              className="px-2.5 py-1.5 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-400/40 text-amber-300 font-bold text-xs shadow transition-all cursor-pointer hover:scale-105"
              title="10 weiße Chips gegen 1 schwarzen Chip tauschen"
            >
              10→1 tauschen
            </button>
          )}
        </div>

        {isTurn ? (
          <div className="flex items-center gap-2">
            <span
              data-testid="turn-indicator"
              className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider animate-pulse"
            >
              Du bist am Zug!
            </span>
            {canFold && (
              <button
                type="button"
                onClick={onFold}
                data-testid="fold-button"
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-rose-600/80 hover:bg-rose-600 text-rose-100 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
                title="Aus dem Durchgang aussteigen und aktuelle Handkarten verdeckt sichern"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Aussteigen</span>
              </button>
            )}
            {canDraw && (
              <button
                type="button"
                onClick={onDrawCard}
                data-testid="draw-button"
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-blue-600/80 hover:bg-blue-600 text-blue-100 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
                title="1 Karte vom Nachziehstapel ziehen"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Ziehen</span>
              </button>
            )}
          </div>
        ) : isFolded ? (
          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-bold text-xs uppercase tracking-wider">
            Du bist ausgestiegen
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-400">Warten auf Mitspieler...</span>
        )}
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
