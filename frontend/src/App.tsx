import type { GameVariant } from '@lama/shared';
import { HelpCircle, Info, LogOut, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import frontendPkg from '../package.json';
import { DiscardPile } from './components/DiscardPile.js';
import { InstallButton } from './components/InstallButton.js';
import { LobbyView } from './components/LobbyView.js';
import { NotificationButton } from './components/NotificationButton.js';
import { Opponent } from './components/Opponent.js';
import { PlayerHand } from './components/PlayerHand.js';
import { getSavedPlayerName, savePlayerName, useGameSocket } from './hooks/useGameSocket.js';
import { useTurnNotifications } from './hooks/useTurnNotifications.js';

// Schwergewichtige Modals erst bei Bedarf laden (RoundSummaryModal zieht
// canvas-confetti in einen separaten Chunk statt in den Initial-Load).
const RulesModal = lazy(() => import('./components/RulesModal.js'));
const RoundSummaryModal = lazy(() => import('./components/RoundSummaryModal.js'));
const VersionInfoModal = lazy(() => import('./components/VersionInfoModal.js'));

export function App() {
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room')?.toUpperCase() || null;
  });
  const [inputCode, setInputCode] = useState(roomCode ?? '');
  const [playerName, setPlayerName] = useState(getSavedPlayerName);
  const [hasJoined, setHasJoined] = useState(
    roomCode !== null && getSavedPlayerName().trim() !== ''
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [variant, setVariant] = useState<GameVariant>('classic');

  const { state, isConnected, error, notification, actions } = useGameSocket(
    hasJoined ? roomCode : null,
    playerName,
    variant
  );

  useTurnNotifications(state);

  useEffect(() => {
    if (playerName) {
      savePlayerName(playerName);
    }
  }, [playerName]);

  // Handle room creation (Variante fix bei Erstellung)
  const handleCreateRoom = async () => {
    if (!playerName.trim()) return;
    setIsCreatingRoom(true);
    try {
      const res = await fetch('/api/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant }),
      });
      const data = (await res.json()) as { roomCode: string; variant?: GameVariant };
      setRoomCode(data.roomCode);
      setHasJoined(true);
    } catch (e) {
      console.error('Room creation failed', e);
      // Fallback local code
      const fallback = 'LAMA';
      setRoomCode(fallback);
      setHasJoined(true);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !inputCode.trim()) return;
    setRoomCode(inputCode.trim().toUpperCase());
    setHasJoined(true);
  };

  const handleLeaveRoom = () => {
    actions.leaveRoom();
    setHasJoined(false);
    setRoomCode(null);
    window.history.replaceState({}, '', '/');
  };

  // Warnung beim Schließen/Neuladen während eines laufenden Durchgangs.
  useEffect(() => {
    if (!hasJoined || state?.phase !== 'IN_ROUND') {
      return;
    }
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [hasJoined, state?.phase]);

  // Welcome / Join Screen
  if (!hasJoined || !roomCode) {
    return (
      <main className="min-h-dvh w-full flex items-center justify-center p-4 felt-table">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-4xl animate-bounce">🦙</span>
            <h1 className="text-3xl font-black text-amber-400">L.A.M.A.</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-semibold mb-6 text-center">
            Lege Alle Minuspunkte Ab! – Online mit Freunden
          </p>

          <div className="w-full space-y-4">
            <div>
              <label
                htmlFor="player-name-input"
                className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5"
              >
                Dein Spielername
              </label>
              <input
                id="player-name-input"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="z. B. Alex"
                maxLength={16}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-bold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
            </div>

            {roomCode === null ? (
              <>
                <fieldset>
                  <legend className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Spielvariante
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`px-3 py-2.5 rounded-xl border font-bold text-sm transition cursor-pointer text-center ${
                        variant === 'classic'
                          ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="game-variant"
                        value="classic"
                        checked={variant === 'classic'}
                        onChange={() => setVariant('classic')}
                        className="sr-only"
                      />
                      🦙 Klassik
                    </label>
                    <label
                      className={`px-3 py-2.5 rounded-xl border font-bold text-sm transition cursor-pointer text-center ${
                        variant === 'party'
                          ? 'bg-pink-500/20 border-pink-400 text-pink-300'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="game-variant"
                        value="party"
                        checked={variant === 'party'}
                        onChange={() => setVariant('party')}
                        className="sr-only"
                      />
                      🎉 Party Edition
                    </label>
                  </div>
                  {variant === 'party' && (
                    <p className="mt-1.5 text-[11px] text-pink-300/80 font-semibold">
                      Mit Pluskarten (Extra-Zug!), pinkem Lama-Joker und 20er-Chips.
                    </p>
                  )}
                </fieldset>
                <button
                  type="button"
                  disabled={!playerName.trim() || isCreatingRoom}
                  onClick={handleCreateRoom}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-102 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>{isCreatingRoom ? 'Erstelle Raum...' : 'Neues Spiel erstellen'}</span>
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-4 text-xs font-extrabold uppercase text-slate-500">
                    Oder beitreten
                  </span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>
              </>
            ) : (
              <div className="w-full p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Einladung zum Raum
                </span>
                <div className="text-2xl font-black tracking-widest text-emerald-400">
                  {roomCode}
                </div>
              </div>
            )}

            <form onSubmit={handleJoinRoom} className="space-y-3">
              <div>
                <label
                  htmlFor="room-code-input"
                  className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5"
                >
                  Raum-Code
                </label>
                <input
                  id="room-code-input"
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="z. B. LAMA"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-black text-center tracking-widest text-lg focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={!playerName.trim() || !inputCode.trim()}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm shadow transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Raum beitreten
              </button>
            </form>
          </div>

          <div className="mt-4 w-full flex justify-center">
            <InstallButton variant="full" />
          </div>

          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Wie funktioniert das Spiel? (Regeln)</span>
          </button>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] leading-none text-slate-500">
            <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>v{frontendPkg.version}</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://github.com/cniweb/LAMA/blob/main/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-slate-600 underline-offset-2 hover:text-slate-300 hover:decoration-slate-400 transition"
            >
              Changelog
            </a>
          </div>
        </div>

        <Suspense fallback={null}>
          <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
        </Suspense>
      </main>
    );
  }

  // Active Game Room Screen
  return (
    <div className="min-h-dvh w-full flex flex-col justify-between felt-table">
      {/* Top Navigation Bar */}
      <header className="w-full px-3 sm:px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-1.5 sm:pb-2.5 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between gap-2 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <span className="text-xl shrink-0">🦙</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              <span className="font-black text-amber-400 text-sm sm:text-base tracking-wider whitespace-nowrap">
                Raum: {roomCode}
              </span>
              {state?.roundNumber ? (
                <span
                  data-testid="round-badge"
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold shrink-0"
                >
                  Durchgang {state.roundNumber}
                </span>
              ) : null}
              {state?.variant === 'party' ? (
                <span
                  data-testid="variant-badge"
                  className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-400/50 text-pink-300 font-bold shrink-0"
                >
                  🎉 Party
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <div
            title={isConnected ? 'Verbunden' : 'Verbindungsaufbau...'}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            {isConnected ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-4 h-4" />
                <span className="hidden sm:inline">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400 animate-pulse">
                <WifiOff className="w-4 h-4" />
                <span className="hidden sm:inline">Getrennt</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setVersionOpen(true)}
            className="p-1 sm:p-1.5 min-w-8 min-h-8 sm:min-w-11 sm:min-h-11 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition cursor-pointer shrink-0"
            title="Version & Changelog"
            aria-label="Version anzeigen"
            data-testid="version-info-button"
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="p-1 sm:p-1.5 min-w-8 min-h-8 sm:min-w-11 sm:min-h-11 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition cursor-pointer shrink-0"
            title="Spielregeln ansehen"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <InstallButton />

          <NotificationButton roomCode={roomCode} />

          <button
            type="button"
            onClick={handleLeaveRoom}
            className="p-1 sm:p-1.5 min-w-8 min-h-8 sm:min-w-11 sm:min-h-11 flex items-center justify-center rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 transition cursor-pointer shrink-0"
            title="Raum verlassen"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Floating Notifications / Errors */}
      {error && (
        <div className="fixed top-14 inset-x-0 mx-auto w-max z-50 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs sm:text-sm shadow-xl animate-fade-in">
          {error}
        </div>
      )}

      {notification && (
        <div className="fixed top-14 inset-x-0 mx-auto w-max z-50 px-4 py-2 rounded-xl bg-slate-900 border border-amber-400/60 text-amber-300 font-extrabold text-xs sm:text-sm shadow-xl animate-fade-in">
          {notification.text}
        </div>
      )}

      {/* Game Content View */}
      {state?.phase === 'LOBBY' ? (
        <main className="flex-1 flex items-center justify-center p-4">
          <LobbyView state={state} onStartGame={actions.startGame} />
        </main>
      ) : state ? (
        <main className="flex-1 flex flex-col justify-between p-2 sm:p-4 max-w-6xl mx-auto w-full">
          {/* Screenreader-Ansage für Zugwechsel und Hinweise */}
          <div aria-live="polite" role="status" className="sr-only">
            {notification?.text ??
              (state.myPlayer.isTurn
                ? 'Du bist am Zug!'
                : (() => {
                    const active = state.opponents.find((opp) => opp.isTurn);
                    return active ? `${active.name} ist am Zug.` : 'Warte auf Mitspieler...';
                  })())}
          </div>
          {/* Opponents Row (Top) */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-1 sm:pt-2">
            {state.opponents.map((opp) => (
              <Opponent key={opp.id} opponent={opp} />
            ))}
          </div>

          {/* Central Table: Draw Pile & Discard Pile */}
          <DiscardPile
            topDiscardCard={state.topDiscardCard}
            discardPileCount={state.discardPileCount}
            drawPileCount={state.drawPileCount}
            isMyTurn={state.myPlayer.isTurn}
            canDraw={state.myPlayer.canDraw}
            isSoloEndspurt={state.isSoloEndspurt}
            onDrawCard={actions.drawCard}
          />

          {/* Player Hand & Controls (Bottom) */}
          <PlayerHand
            hand={state.myPlayer.hand}
            chips={state.myPlayer.chips}
            totalScore={state.myPlayer.totalScore}
            status={state.myPlayer.status}
            isTurn={state.myPlayer.isTurn}
            validPlays={state.myPlayer.validPlays}
            canDraw={state.myPlayer.canDraw}
            canFold={state.myPlayer.canFold}
            isSoloEndspurt={state.isSoloEndspurt}
            soloDiscardedValues={state.soloDiscardedValues}
            isParty={state.variant === 'party'}
            onPlayCard={actions.playCard}
            onDrawCard={actions.drawCard}
            onFold={actions.fold}
            onExchangeChips={actions.exchangeChips}
          />

          {/* Round Summary & Chip Discard Modal */}
          <Suspense fallback={null}>
            <RoundSummaryModal
              state={state}
              onDiscardChip={actions.discardChip}
              onNextRound={actions.nextRound}
              onNewGame={actions.newGame}
              onLeaveRoom={handleLeaveRoom}
            />
          </Suspense>
        </main>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 font-bold text-sm">
          Verbinde mit Raum {roomCode}...
        </div>
      )}

      {/* Rules Modal */}
      <Suspense fallback={null}>
        <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
      </Suspense>

      {/* Version Info Modal */}
      <Suspense fallback={null}>
        <VersionInfoModal isOpen={versionOpen} onClose={() => setVersionOpen(false)} />
      </Suspense>
    </div>
  );
}
export default App;
