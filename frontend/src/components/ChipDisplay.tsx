import type { ChipCount, ChipType } from '@lama/shared';
import type React from 'react';

interface ChipDisplayProps {
  chips: ChipCount;
  totalScore?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onSelectChip?: (type: ChipType) => void;
  className?: string;
}

export const ChipDisplay: React.FC<ChipDisplayProps> = ({
  chips,
  totalScore,
  size = 'md',
  interactive = false,
  onSelectChip,
  className = '',
}) => {
  const chipSizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 sm:w-9 sm:h-9 text-sm',
    lg: 'w-12 h-12 text-base font-bold',
  }[size];

  const pink = chips.pink ?? 0;
  const score = totalScore ?? chips.white * 1 + chips.black * 10 + pink * 20;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Pink Chips (20s, Party Edition) */}
      {pink > 0 || interactive ? (
        <div className="flex items-center gap-1.5" title="Pinke Chips (je 20 Minuspunkte)">
          <button
            type="button"
            disabled={!interactive || pink === 0}
            onClick={() => onSelectChip?.('pink')}
            className={`relative rounded-full flex items-center justify-center font-black shadow-md border-2 border-dashed border-pink-300 bg-pink-500 text-pink-950 transition-all ${chipSizes} ${
              interactive && pink > 0
                ? 'cursor-pointer hover:scale-110 hover:ring-4 hover:ring-pink-400/60 ring-offset-2 ring-offset-slate-900'
                : ''
            } ${pink === 0 && interactive ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <span>20</span>
          </button>
          <span className="font-bold text-slate-200 text-sm sm:text-base">×{pink}</span>
        </div>
      ) : null}

      {/* Black Chips (10s) */}
      <div className="flex items-center gap-1.5" title="Schwarze Chips (je 10 Minuspunkte)">
        <button
          type="button"
          disabled={!interactive || chips.black === 0}
          onClick={() => onSelectChip?.('black')}
          className={`relative rounded-full flex items-center justify-center font-black shadow-md border-2 border-dashed border-slate-400 bg-slate-900 text-amber-400 transition-all ${chipSizes} ${
            interactive && chips.black > 0
              ? 'cursor-pointer hover:scale-110 hover:ring-4 hover:ring-amber-400/60 ring-offset-2 ring-offset-slate-900'
              : ''
          } ${chips.black === 0 && interactive ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <span>10</span>
        </button>
        <span className="font-bold text-slate-200 text-sm sm:text-base">×{chips.black}</span>
      </div>

      {/* White Chips (1s) */}
      <div className="flex items-center gap-1.5" title="Weiße Chips (je 1 Minuspunkt)">
        <button
          type="button"
          disabled={!interactive || chips.white === 0}
          onClick={() => onSelectChip?.('white')}
          className={`relative rounded-full flex items-center justify-center font-black shadow-md border-2 border-dashed border-slate-300 bg-slate-100 text-slate-900 transition-all ${chipSizes} ${
            interactive && chips.white > 0
              ? 'cursor-pointer hover:scale-110 hover:ring-4 hover:ring-white/60 ring-offset-2 ring-offset-slate-900'
              : ''
          } ${chips.white === 0 && interactive ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <span>1</span>
        </button>
        <span className="font-bold text-slate-200 text-sm sm:text-base">×{chips.white}</span>
      </div>

      {/* Total Score Badge */}
      <div className="ml-1 px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 font-extrabold text-xs sm:text-sm shadow-inner">
        {score} Pkt.
      </div>
    </div>
  );
};
