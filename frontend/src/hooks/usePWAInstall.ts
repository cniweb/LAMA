import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return false;
}

function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIOSUA = /iphone|ipad|ipod/.test(ua);
  // iPadOS 13+ masquerades as Mac, check touch + platform
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIOSUA || isIPadOS;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandalone());
  const [isIOS] = useState<boolean>(() => isIOSDevice());

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // Re-check standalone on display-mode change
    const mql = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) setIsInstalled(true);
    };
    mql.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      mql.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  // Can prompt natively via beforeinstallprompt
  const canPrompt = deferredPrompt !== null;
  // Show install entry for iOS (manual add-to-home-screen) or when native prompt is ready
  const canInstall = !isInstalled && (canPrompt || isIOS);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  };

  return {
    deferredPrompt,
    isInstalled,
    isIOS,
    canInstall,
    canPrompt,
    promptInstall,
  };
}
