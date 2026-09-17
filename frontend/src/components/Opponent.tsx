import type { ClientOpponentView } from '@lama/shared';
import { WifiOff } from 'lucide-react';
import type React from 'react';
import { Card } from './Card.js';
import { ChipDisplay } from './ChipDisplay.js';

interface OpponentProps {
  opponent: ClientOpponentView;
}

export const Opponent: React.FC<OpponentProps> = ({ opponent }) => {
  const isFolded = opponent.status === 'FOLDED';

  return (
    <div
      className={`relative flex flex-col items-center p-2 sm:p-3 rounded-2xl transition-all duration-200 border ${
        opponent.isTurn
          ? 'bg-amber-500/15 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)] scale-105'
          : isFolded
            ? 'bg-slate-900/40 border-slate-700/50 opacity-70'
            : 'bg-slate-900/70 border-slate-800'
      }`}
    >
      {/* Turn indicator banner */}
      {opponent.isTurn && (
        <div className="absolute -top-3 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] tracking-wider uppercase animate-pulse shadow-md">
          Am Zug
        </div>
      )}

      {/* Folded indicator banner */}
      {isFolded && (
        <div className="absolute -top-3 px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-bold text-[11px] tracking-wider uppercase shadow-md">
          Ausgestiegen
        </div>
      )}

      {/* Opponent Info Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-slate-950 text-xs sm:text-sm shadow">
          {opponent.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xs sm:text-sm text-slate-100 max-w-[100px] truncate">
              {opponent.name}
            </span>
            {!opponent.connected && (
              <span title="Verbindung verloren" className="text-rose-400">
                <WifiOff className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cards Fan (Face Down) */}
      <div className="relative h-14 sm:h-16 flex items-center justify-center mb-2 px-3">
        {opponent.cardCount === 0 ? (
          <span className="text-xs text-slate-400 italic">Keine Handkarten</span>
        ) : (
          <div className="opponent-fan flex -space-x-4 sm:-space-x-5">
            {Array.from({ length: Math.min(opponent.cardCount, 8) }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  transform: `rotate(${(idx - (Math.min(opponent.cardCount, 8) - 1) / 2) * 5}deg)`,
                }}
                className="transition-transform"
              >
                <Card faceDown size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[11px] font-bold text-slate-400 mb-1.5">
        {opponent.cardCount} {opponent.cardCount === 1 ? 'Karte' : 'Karten'}
      </div>

      {/* Opponent Chips */}
      <ChipDisplay chips={opponent.chips} totalScore={opponent.totalScore} size="sm" />
    </div>
  );
};
