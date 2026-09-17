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
  onPlayCard: (card: CardValue) => void;
  onDrawCard: () => void;
  onFold: () => void;
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
  onPlayCard,
  onDrawCard,
  onFold,
}) => {
  const isFolded = status === 'FOLDED';

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Turn Action Controls Header */}
      <div className="flex items-center justify-between w-full max-w-2xl px-4 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-extrabold text-slate-300">Deine Chips:</span>
          <ChipDisplay chips={chips} totalScore={totalScore} size="sm" />
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-rose-100 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-blue-100 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
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
        <div className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-bounce">
          ⚡ Solo-Endspurt! Alle anderen sind ausgestiegen. Du darfst nicht mehr nachziehen!
        </div>
      )}

      {/* Hand Cards Fan */}
      <div
        data-testid="player-hand"
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 py-2 px-2 max-w-4xl min-h-[110px] sm:min-h-[140px]"
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
                  size="md"
                  onPlay={onPlayCard}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
