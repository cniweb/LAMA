import type { CardValue } from '@lama/shared';
import type React from 'react';
import { memo, useCallback } from 'react';

interface CardProps {
  value?: CardValue;
  faceDown?: boolean;
  playable?: boolean;
  disabled?: boolean;
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  /** Stabile Alternative zu onClick: wird mit `value` aufgerufen (memo-freundlich). */
  onPlay?: (card: CardValue) => void;
  className?: string;
}

function cardLabel(value: CardValue): string {
  if (value === 'L' || value === 'PL' || value === 'GL') return '🦙';
  if (value === 'SK') return '⛔';
  if (value === 'D2') return '+2';
  if (value === 'GF') return '🎁';
  if (typeof value === 'string') return value.replace('+', '+');
  return String(value);
}

function cardNumber(value: CardValue): string {
  if (value === 'L' || value === 'PL' || value === 'GL') return '🦙';
  if (value === 'SK') return '⛔';
  if (value === 'D2') return '+2';
  if (value === 'GF') return '🎁';
  if (typeof value === 'string') return value[0];
  return String(value);
}

/** Crazy-Aktionskarte (Skip/Draw-Two/Gift)? */
function isActionCardValue(value: CardValue): boolean {
  return value === 'SK' || value === 'D2' || value === 'GF';
}

const CARD_STYLES: Record<CardValue, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-yellow-100', text: 'text-amber-800', border: 'border-amber-300' },
  2: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  3: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  4: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  5: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  6: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  L: { bg: 'bg-amber-300', text: 'text-amber-950', border: 'border-amber-500' },
  PL: { bg: 'bg-pink-300', text: 'text-pink-950', border: 'border-pink-500' },
  '1+': { bg: 'bg-yellow-100', text: 'text-amber-800', border: 'border-amber-300' },
  '2+': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  '3+': { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  '4+': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  '5+': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  '6+': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  // Crazy Edition: goldenes Lama + zahllose Aktionskarten.
  GL: { bg: 'bg-amber-400', text: 'text-amber-950', border: 'border-yellow-600' },
  SK: { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' },
  D2: { bg: 'bg-cyan-200', text: 'text-cyan-900', border: 'border-cyan-400' },
  GF: { bg: 'bg-fuchsia-200', text: 'text-fuchsia-900', border: 'border-fuchsia-400' },
};

/** Tooltip-Text für die Crazy-Aktionskarten und das goldene Lama. */
function crazyTitle(value: CardValue): string | null {
  if (value === 'GL') return 'Goldenes Lama (Joker + Reset, 30 Minuspunkte)';
  if (value === 'SK') return 'Skip: nächster Spieler wird übersprungen';
  if (value === 'D2') return 'Draw-Two: nächster Spieler zieht 2 und setzt aus';
  if (value === 'GF') return 'Gift: höchste Handkarte geht an den Spieler mit den wenigsten Karten';
  return null;
}

export const Card: React.FC<CardProps> = memo(function Card({
  value,
  faceDown = false,
  playable = false,
  disabled = false,
  size = 'md',
  onClick,
  onPlay,
  className = '',
}) {
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (value !== undefined) {
      onPlay?.(value);
    }
  }, [onClick, onPlay, value]);

  const interactive = playable && (onClick !== undefined || onPlay !== undefined);
  // Kompakte Mini-Karte (z. B. in der Rundenabrechnung): fester, kleiner Rahmen,
  // bei dem Sonderkarten-Labels ausgeblendet werden, damit nichts überläuft.
  const isCompact = size === 'xxs';
  const sizeClasses = {
    xxs: 'w-7 h-10 text-[11px] rounded border',
    xs: 'w-12 h-[76px] text-lg rounded-lg border-2',
    sm: 'w-10 h-16 text-sm rounded-md border-2',
    md: 'w-16 h-24 sm:w-20 sm:h-32 text-xl sm:text-2xl rounded-xl border-3 sm:border-4',
    lg: 'w-24 h-36 sm:w-28 sm:h-44 text-3xl sm:text-4xl rounded-2xl border-4',
  }[size];

  if (faceDown || value === undefined) {
    return (
      <div
        className={`relative select-none flex items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 border-indigo-400/50 shadow-md transition-all ${sizeClasses} ${className}`}
      >
        <div className="absolute inset-1 rounded border border-indigo-300/30 flex items-center justify-center bg-indigo-950/40">
          <span className="text-indigo-300/60 font-black tracking-widest text-xs sm:text-sm">
            🦙
          </span>
        </div>
      </div>
    );
  }

  const style = CARD_STYLES[value];
  const isPlus = typeof value === 'string' && value.endsWith('+');
  const isPink = value === 'PL';
  const isGolden = value === 'GL';
  const isAction = isActionCardValue(value);
  const crazyTooltip = crazyTitle(value);

  return (
    <button
      type="button"
      disabled={disabled || !interactive}
      onClick={interactive ? handleClick : undefined}
      title={
        crazyTooltip
          ? crazyTooltip
          : isPink
            ? 'Pinkes Lama (Joker)'
            : isPlus
              ? `${value} (Pluskarte: Extra-Zug)`
              : cardLabel(value)
      }
      className={`relative select-none overflow-hidden font-black flex flex-col justify-between ${
        isCompact ? 'p-0.5' : 'p-1.5 sm:p-2.5'
      } shadow-lg transition-all duration-150 ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${
        playable ? 'card-playable cursor-pointer' : ''
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
    >
      {/* Top Left Corner (in der Mini-Karte ausgeblendet, um Platz zu sparen) */}
      {!isCompact && (
        <div className="self-start leading-none font-extrabold text-xs sm:text-base">
          {cardNumber(value)}
          {isPlus && <span className="text-emerald-600">+</span>}
          {isPink && <span className="text-pink-600 text-[10px]">★</span>}
          {isGolden && <span className="text-yellow-700 text-[10px]">★</span>}
        </div>
      )}

      {/* Card Center Illustration */}
      <div
        className={`flex flex-col items-center justify-center leading-none ${
          isCompact ? 'flex-1' : 'self-center my-auto'
        }`}
      >
        {value === 'L' || value === 'PL' || value === 'GL' ? (
          <div className="flex flex-col items-center">
            <span
              className={`${isCompact ? 'text-sm' : 'text-2xl sm:text-4xl'} filter drop-shadow`}
            >
              🦙
            </span>
            {/* Textlabel nur außerhalb der Mini-Karte – sonst läuft der Inhalt über. */}
            {!isCompact && (
              <span
                className={`text-[10px] sm:text-xs font-black tracking-wider uppercase mt-0.5 px-1 rounded ${
                  isPink ? 'bg-pink-500/30' : isGolden ? 'bg-yellow-600/30' : 'bg-amber-500/20'
                }`}
              >
                {isPink ? 'PINK' : isGolden ? 'GOLD' : 'LAMA'}
              </span>
            )}
          </div>
        ) : isAction ? (
          <div className="flex flex-col items-center">
            <span
              className={`${isCompact ? 'text-sm' : 'text-2xl sm:text-4xl'} filter drop-shadow`}
            >
              {cardNumber(value)}
            </span>
            {!isCompact && (
              <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase mt-0.5 px-1 rounded bg-black/10">
                {value === 'SK' ? 'SKIP' : value === 'D2' ? 'ZIEH 2' : 'GIFT'}
              </span>
            )}
          </div>
        ) : (
          <span className="font-black tracking-tighter drop-shadow-sm">
            {cardNumber(value)}
            {isPlus && <span className="text-emerald-600">+</span>}
          </span>
        )}
      </div>

      {/* Bottom Right Corner (in der Mini-Karte ausgeblendet) */}
      {!isCompact && (
        <div className="self-end leading-none font-extrabold rotate-180 text-xs sm:text-base">
          {cardNumber(value)}
          {isPlus && <span className="text-emerald-600">+</span>}
        </div>
      )}
    </button>
  );
});
