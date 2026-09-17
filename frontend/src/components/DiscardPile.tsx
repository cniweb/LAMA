import type { CardValue } from '@lama/shared';
import { Layers } from 'lucide-react';
import type React from 'react';
import { Card } from './Card.js';

interface DiscardPileProps {
  topDiscardCard: CardValue | null;
  discardPileCount: number;
  drawPileCount: number;
  isMyTurn: boolean;
  canDraw: boolean;
  isSoloEndspurt: boolean;
  onDrawCard: () => void;
}

export const DiscardPile: React.FC<DiscardPileProps> = ({
  topDiscardCard,
  discardPileCount,
  drawPileCount,
  isMyTurn,
  canDraw,
  isSoloEndspurt,
  onDrawCard,
}) => {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-12 my-auto py-1 sm:py-2">
      {/* Draw Pile (Nachziehstapel) */}
      <div className="flex flex-col items-center">
        <div className="relative group">
          {drawPileCount > 0 ? (
            <button
              type="button"
              disabled={!canDraw}
              onClick={canDraw ? onDrawCard : undefined}
              className={`relative transition-all duration-200 ${
                canDraw
                  ? 'cursor-pointer hover:scale-105 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]'
                  : 'cursor-not-allowed opacity-90'
              }`}
            >
              {/* Stack effect */}
              {drawPileCount > 2 && (
                <div className="absolute top-1 left-1 pointer-events-none opacity-50">
                  <Card faceDown size="md" className="sm:w-28 sm:h-44 sm:text-4xl sm:rounded-2xl" />
                </div>
              )}
              {drawPileCount > 1 && (
                <div className="absolute top-0.5 left-0.5 pointer-events-none opacity-80">
                  <Card faceDown size="md" className="sm:w-28 sm:h-44 sm:text-4xl sm:rounded-2xl" />
                </div>
              )}
              <Card faceDown size="md" className="sm:w-28 sm:h-44 sm:text-4xl sm:rounded-2xl" />

              {/* Draw Pile Count Badge */}
              <div className="absolute -bottom-2.5 inset-x-0 mx-auto w-max px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-xs font-black shadow-md">
                {drawPileCount} {drawPileCount === 1 ? 'Karte' : 'Karten'}
              </div>
            </button>
          ) : (
            <div className="w-16 h-24 sm:w-28 sm:h-44 rounded-2xl border-2 border-dashed border-slate-700/60 flex flex-col items-center justify-center text-slate-500 font-bold text-xs p-2 text-center">
              <Layers className="w-6 h-6 mb-1 opacity-50" />
              <span>Nachziehstapel leer</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Nachziehstapel
          </span>
          {isMyTurn && isSoloEndspurt && (
            <span className="hidden sm:inline text-[11px] font-extrabold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded mt-1">
              Im Solo-Endspurt gesperrt
            </span>
          )}
        </div>
      </div>

      {/* Discard Pile (Ablagestapel) */}
      <div className="flex flex-col items-center">
        <div className="relative">
          {/* Subtle stack effect */}
          {discardPileCount > 1 && (
            <div className="absolute top-1 -left-1 pointer-events-none opacity-40 rotate-[-4deg]">
              <Card faceDown size="md" className="sm:w-28 sm:h-44 sm:text-4xl sm:rounded-2xl" />
            </div>
          )}

          {topDiscardCard !== null ? (
            <Card
              value={topDiscardCard}
              size="md"
              className="sm:w-28 sm:h-44 sm:text-4xl sm:rounded-2xl"
            />
          ) : (
            <div className="w-16 h-24 sm:w-28 sm:h-44 rounded-2xl border-2 border-dashed border-slate-700/60 flex items-center justify-center text-slate-500 font-bold text-xs">
              Ablage
            </div>
          )}

          <div className="absolute -bottom-2.5 inset-x-0 mx-auto w-max px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold shadow-md">
            {discardPileCount} abgelegt
          </div>
        </div>

        <span className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
          Ablagestapel
        </span>
      </div>
    </div>
  );
};
