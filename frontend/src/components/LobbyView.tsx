import type { ClientRoomView } from '@lama/shared';
import { Check, Copy, Crown, Play, Users, WifiOff } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

interface LobbyViewProps {
  state: ClientRoomView;
  onStartGame: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ state, onStartGame }) => {
  const [copied, setCopied] = useState(false);

  const copyInviteLink = () => {
    const url = `${window.location.origin}/?room=${state.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPlayers = state.opponents.length + 1;
  const canStart = state.isHost && totalPlayers >= 2;

  return (
    <div className="w-full max-w-xl mx-auto my-auto p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col items-center">
      {/* Title & Badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-3xl">🦙</span>
        <h1 className="text-2xl sm:text-3xl font-black text-amber-400">LAMA Spiellobby</h1>
      </div>
      <p className="text-xs sm:text-sm text-slate-400 text-center mb-6">
        Lade deine Freunde ein. Sobald mindestens 2 Spieler im Raum sind, kann es losgehen!
      </p>

      {/* Room Code Card */}
      <div className="w-full p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Raum-Code:
          </span>
          <div className="text-2xl sm:text-3xl font-black tracking-widest text-emerald-400">
            {state.roomCode}
          </div>
        </div>

        <button
          type="button"
          onClick={copyInviteLink}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs sm:text-sm border border-slate-700 transition-all cursor-pointer shadow"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Link kopiert!' : 'Link teilen'}</span>
        </button>
      </div>

      {/* Players in Room */}
      <div className="w-full mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>Spieler im Raum ({totalPlayers}/6)</span>
          </span>
          {totalPlayers < 2 && (
            <span className="text-xs text-amber-400/90 font-medium">
              Noch mind. 1 weiterer Spieler nötig
            </span>
          )}
        </div>

        <div className="space-y-2">
          {/* Me */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-black text-slate-950 text-xs">
                {state.myPlayer.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-slate-100">{state.myPlayer.name}</span>
                <span className="text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                  Du
                </span>
              </div>
            </div>
            {state.isHost && (
              <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                <Crown className="w-3.5 h-3.5" />
                <span>Host</span>
              </span>
            )}
          </div>

          {/* Opponents */}
          {state.opponents.map((opp) => (
            <div
              key={opp.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-black text-slate-200 text-xs">
                  {opp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-200">{opp.name}</span>
                  {!opp.connected && (
                    <span title="Getrennt" className="text-rose-400">
                      <WifiOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
              {opp.id === state.hostId && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Host</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Start Button */}
      {state.isHost ? (
        <button
          type="button"
          disabled={!canStart}
          onClick={onStartGame}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-base shadow-xl transition-all ${
            canStart
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 cursor-pointer hover:scale-102'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{canStart ? 'Partie starten' : 'Warte auf Mitspieler (mind. 2)...'}</span>
        </button>
      ) : (
        <div className="text-center p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs sm:text-sm text-slate-400">
          Warte darauf, dass der Host das Spiel startet...
        </div>
      )}
    </div>
  );
};
