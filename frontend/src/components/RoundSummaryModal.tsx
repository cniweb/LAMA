import type { ChipType, ClientRoomView } from '@lama/shared';
import confetti from 'canvas-confetti';
import { ArrowRight, Sparkles, Trophy } from 'lucide-react';
import type React from 'react';
import { useEffect } from 'react';
import { useModalDialog } from '../hooks/useModalDialog.js';
import { Card } from './Card.js';

interface RoundSummaryModalProps {
  state: ClientRoomView;
  onDiscardChip: (chipType: ChipType) => void;
  onNextRound: () => void;
  onNewGame: () => void;
  onLeaveRoom: () => void;
}

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({
  state,
  onDiscardChip,
  onNextRound,
  onNewGame,
  onLeaveRoom,
}) => {
  const isGameOver = state.phase === 'GAME_OVER';
  const isPendingMyChipDiscard = state.pendingChipDiscardPlayerId === state.myPlayer.id;
  // Blockierender Dialog (kein onClose): Fokus-Falle ja, Esc-Schließen nein.
  const dialogRef = useModalDialog<HTMLDivElement>(true);

  useEffect(() => {
    if (!(isGameOver || isPendingMyChipDiscard)) {
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, [isGameOver, isPendingMyChipDiscard]);

  if (
    state.phase !== 'ROUND_SUMMARY' &&
    state.phase !== 'GAME_OVER' &&
    !state.pendingChipDiscardPlayerId
  ) {
    return null;
  }

  return (
    <div
      data-testid="round-summary"
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-summary-title"
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center">
        {/* Header */}
        {isGameOver ? (
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 mb-3 animate-bounce">
              <Trophy className="w-9 h-9" />
            </div>
            <h2 id="round-summary-title" className="text-2xl sm:text-3xl font-black text-amber-400">
              Spiel beendet!
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Mindestens ein Spieler hat 40 Minuspunkte erreicht.
            </p>
            {state.winners && state.winners.length > 0 && (
              <div className="mt-3 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-extrabold text-base">
                🏆 Sieger: {state.winners.map((w) => `${w.name} (${w.score} Pkt.)`).join(', ')}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100 flex items-center gap-2">
              <span id="round-summary-title">Durchgang {state.roundNumber} beendet</span>
              <Sparkles className="w-6 h-6 text-amber-400" />
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Abrechnung nach dem Einmaligkeits-Prinzip
            </p>
          </div>
        )}

        {/* Bonus Chip Discard Dialog */}
        {isPendingMyChipDiscard && (
          <div className="w-full mb-6 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-400/70 flex flex-col items-center text-center animate-pulse">
            <span className="text-lg font-black text-amber-300 mb-1">
              🎉 Du hast alle Karten abgelegt!
            </span>
            <span className="text-xs sm:text-sm text-slate-200 mb-3">
              Als Belohnung darfst du einen deiner Chips abgeben:
            </span>
            <div className="flex items-center gap-4">
              {(state.myPlayer.chips.pink ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => onDiscardChip('pink')}
                  data-testid="discard-pink-chip"
                  className="px-4 py-2 min-h-[44px] rounded-xl bg-pink-500 text-pink-950 font-black text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-full bg-pink-300 border border-pink-700 flex items-center justify-center text-xs">
                    20
                  </span>
                  <span>Pinken 20er abgeben (-20 Pkt.)</span>
                </button>
              )}
              {state.myPlayer.chips.black > 0 && (
                <button
                  type="button"
                  onClick={() => onDiscardChip('black')}
                  data-testid="discard-black-chip"
                  className="px-4 py-2 min-h-[44px] rounded-xl bg-slate-950 border-2 border-amber-400 text-amber-300 font-black text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-xs">
                    10
                  </span>
                  <span>Schwarzen 10er abgeben (-10 Pkt.)</span>
                </button>
              )}
              {state.myPlayer.chips.white > 0 && (
                <button
                  type="button"
                  onClick={() => onDiscardChip('white')}
                  data-testid="discard-white-chip"
                  className="px-4 py-2 min-h-[44px] rounded-xl bg-slate-100 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-full bg-slate-200 border border-slate-400 flex items-center justify-center text-xs">
                    1
                  </span>
                  <span>Weißen 1er abgeben (-1 Pkt.)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scores Table */}
        <div className="w-full space-y-3 mb-6">
          {state.lastRoundSummary?.map((score) => (
            <div
              key={score.playerId}
              className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                score.playerId === state.myPlayer.id
                  ? 'bg-emerald-950/30 border-emerald-500/50'
                  : 'bg-slate-800/60 border-slate-700/60'
              }`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm sm:text-base text-slate-100">
                    {score.playerName}
                  </span>
                  {score.playerId === state.myPlayer.id && (
                    <span className="text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                      Du
                    </span>
                  )}
                  {score.bonusChipReturned && (
                    <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      -
                      {score.bonusChipReturned === 'pink'
                        ? 20
                        : score.bonusChipReturned === 'black'
                          ? 10
                          : 1}{' '}
                      Chip-Bonus!
                    </span>
                  )}
                </div>

                {/* Cards remaining display */}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {score.cards.length === 0 ? (
                    <span className="text-xs font-bold text-emerald-400">0 Karten (0 Pkt.)</span>
                  ) : (
                    score.cards.map((c, i) => (
                      <Card key={i} value={c} size="sm" className="!w-7 !h-10 !text-xs !p-0.5" />
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-700/50">
                <div className="text-xs text-slate-400">+{score.uniquePoints} Pkt.</div>
                <div className="text-right">
                  <div className="text-sm sm:text-base font-black text-rose-300">
                    Gesamt: {score.totalScoreAfterRound} Pkt.
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        {!isGameOver && !state.pendingChipDiscardPlayerId && (
          <button
            type="button"
            onClick={onNextRound}
            data-testid="next-round-button"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base shadow-xl hover:scale-105 transition-all cursor-pointer"
          >
            <span>Nächsten Durchgang starten</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        {/* Neues Spiel / Raum verlassen: nach Rundenende für alle sichtbar */}
        {(isGameOver || (!isGameOver && !state.pendingChipDiscardPlayerId)) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onNewGame}
              data-testid="new-game-button"
              className="px-5 py-3 min-h-[44px] rounded-2xl bg-slate-100 hover:bg-white text-slate-950 font-black text-sm shadow-xl hover:scale-105 transition-all cursor-pointer"
            >
              Neues Spiel
            </button>
            <button
              type="button"
              onClick={onLeaveRoom}
              data-testid="leave-room-button"
              className="px-5 py-3 min-h-[44px] rounded-2xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-black text-sm shadow transition-all cursor-pointer"
            >
              Raum verlassen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoundSummaryModal;
