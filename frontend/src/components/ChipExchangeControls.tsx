import type { ChipCount } from '@lama/shared';
import type React from 'react';
import { ChipDisplay } from './ChipDisplay.js';

interface ChipExchangeControlsProps {
  chips: ChipCount;
  totalScore: number;
  hasPinkChips: boolean;
  exchangeAllowed: boolean;
  allowWrap?: boolean;
  onExchangeChips?: (from: 'white' | 'black') => void;
}

export const ChipExchangeControls: React.FC<ChipExchangeControlsProps> = ({
  chips,
  totalScore,
  hasPinkChips,
  exchangeAllowed,
  allowWrap = false,
  onExchangeChips,
}) => (
  <div
    className={`flex min-w-0 flex-1 items-center justify-between gap-1 ${allowWrap ? 'flex-wrap' : 'flex-nowrap'}`}
  >
    <div className="flex min-w-0 items-center gap-1">
      <span className="sr-only shrink-0 whitespace-nowrap text-xs font-extrabold text-slate-300 sm:not-sr-only">
        Deine Chips:
      </span>
      <ChipDisplay
        chips={chips}
        totalScore={totalScore}
        size="sm"
        totalScoreVisibility="sm"
        className="shrink-0 gap-1 sm:gap-2"
      />
    </div>

    {exchangeAllowed && onExchangeChips && (
      <div className="flex shrink-0 items-center gap-1">
        {chips.white >= 10 && (
          <button
            type="button"
            onClick={() => onExchangeChips('white')}
            data-testid="exchange-chips-button"
            aria-label="10 weiße Chips gegen 1 schwarzen Chip tauschen"
            className="inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-amber-400/40 bg-slate-800 px-1 text-[10px] font-bold text-amber-300 shadow transition-colors hover:bg-slate-700"
            title="10 weiße Chips gegen 1 schwarzen Chip tauschen"
          >
            10→1
          </button>
        )}
        {hasPinkChips && chips.black >= 2 && (
          <button
            type="button"
            onClick={() => onExchangeChips('black')}
            data-testid="exchange-black-to-pink-button"
            aria-label="2 schwarze Chips gegen 1 pinken 20er-Chip tauschen"
            className="inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-pink-400/40 bg-pink-950/60 px-1 text-[9px] font-bold text-pink-300 shadow transition-colors hover:bg-pink-900"
            title="2 schwarze Chips gegen 1 pinken 20er-Chip tauschen (Party & Crazy)"
          >
            2×10→20
          </button>
        )}
      </div>
    )}
  </div>
);
