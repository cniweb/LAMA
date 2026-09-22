import { Bell, BellOff } from 'lucide-react';
import { useState } from 'react';
import { usePushSubscription } from '../hooks/usePushSubscription.js';

export function NotificationButton({ roomCode }: { roomCode: string | null }) {
  const { permission, isSupported, isSubscribed, isBusy, subscribe, unsubscribe } =
    usePushSubscription(roomCode);
  const [hint, setHint] = useState<string | null>(null);

  if (!isSupported) return null;

  // Don't show when no room yet (welcome screen) – but keep for active room
  if (!roomCode) return null;

  const handleToggle = async () => {
    setHint(null);
    if (isSubscribed) {
      await unsubscribe();
      setHint('Benachrichtigungen aus');
      setTimeout(() => setHint(null), 2500);
      return;
    }
    if (permission === 'denied') {
      setHint('Im Browser freigeben: Seite → Website-Einstellungen');
      setTimeout(() => setHint(null), 4000);
      return;
    }
    const ok = await subscribe();
    if (ok) {
      setHint('Aktiviert – du wirst bei deinem Zug benachrichtigt');
      // Show a test notification to prove it works while page is open
      try {
        if (Notification.permission === 'granted') {
          new Notification('LAMA Benachrichtigungen aktiv', {
            body: 'Du erhältst jetzt eine Meldung, wenn du am Zug bist – auch wenn der Browser im Hintergrund ist.',
            icon: '/icon.svg',
          });
        }
      } catch {}
    } else {
      setHint('Konnte nicht aktiviert werden');
    }
    setTimeout(() => setHint(null), 3500);
  };

  const title = isSubscribed
    ? 'Benachrichtigungen deaktivieren'
    : 'Bei eigenem Zug benachrichtigen';

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isBusy}
        className={`p-1.5 min-w-11 min-h-11 flex items-center justify-center rounded-lg border transition cursor-pointer disabled:opacity-50 ${
          isSubscribed
            ? 'bg-amber-400/20 border-amber-400 text-amber-300 hover:bg-amber-400/30'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
        }`}
        title={title}
        aria-label={title}
        data-testid="notification-button"
        aria-pressed={isSubscribed}
      >
        {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
      </button>
      {hint && (
        <div className="absolute top-full mt-2 right-0 z-40 w-56 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 shadow-xl">
          {hint}
        </div>
      )}
    </div>
  );
}
