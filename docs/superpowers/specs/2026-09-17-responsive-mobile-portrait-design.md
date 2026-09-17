# LAMA Mobile-Portrait Responsive-Design (Kompakt-Portrait)

Datum: 2026-09-17 | Status: vom Nutzer abgenommen (beide Design-Blöcke)

## Ziel

Der Spiel-Screen ist auf mobilen Endgeräten im **Hochformat** vollständig **ohne
Scrollen** sichtbar und per Touch gut bedienbar. Geltungsbereich: Join-Screen,
Lobby, Spiel-Screen (Gegner, Stapel, Hand), Abrechnungs- und Regel-Modal.
Querformat erhält bewusst **kein** eigenes Layout (darf scrollen, kein
Drehen-Hinweis — YAGNI).

Referenz-Viewport: 360×740 (kleine Android-/iOS-Geräte). Höhenbudget
(Ungefähr, nutzbare Höhe nach Browser-Chrome): Header ~48px, Gegner-Zeile
~100px, Stapel ~170px, Steuerleiste ~80px, Hand ~100px → ~500px Gesamt.

## 1. Karten & Stapel

- Neue `Card`-Größe `xs` (ca. 48×72px), nur unterhalb `sm:` für die
  Spielerhand. 6 Karten + Gaps ≈ 328px → eine Reihe auf 360px, kein Wrap.
- `DiscardPile`: Nachzieh- und Ablagestapel auf Mobile von `lg` (144px hoch)
  auf `md` (96px). Spart inkl. Badge/Label ca. 60px Höhe pro Stapel.
- Desktop (`sm:` und größer) unverändert: `md`-Hand, `lg`-Stapel.
- Spielbarkeits-Signal (Glow/Raise bei `playable`) bleibt erhalten;
  Hover-Vergrößerung bleibt Desktop-Sache.

## 2. Gegner-Zeile & Steuerleiste

- `Opponent`: kompakte Mobile-Variante (Avatar + Name + Kartenzähler
  einzeilig, verdeckte Karten kleiner und stärker überlappt), damit bis zu
  5 Gegner keine zweite Reihe erzwingen.
- `PlayerHand`-Steuerkopf: auf Mobile zweizeilig — Zeile 1: Chips +
  Zug-Badge/Status, Zeile 2: Aktionen (Aussteigen/Ziehen) in voller Breite.
  Desktop-Layout (einzeilig) unverändert.

## 3. Viewport, Safe-Area & Touch-Targets

- `min-h-screen` → `min-h-dvh` (App-Root, Join-Screen), damit mobile
  Browser-Leisten keine Scroll-Höhe erzeugen.
- Safe-Area-Insets: `env(safe-area-inset-bottom)` als Bottom-Padding der
  Hand-Zone, Top-Padding am Header für die Notch. Kein Inhalt hinter
  Home-Indikator oder Notch.
- Touch-Targets ≥ 44px: Header-Icon-Buttons (aktuell ~28px),
  Zug-Aktions-Buttons, Chip-Bonus-Buttons im Abrechnungs-Modal. Karten sind
  über ihre Fläche (≥ 48×72px) treffbar.
- Keine `shared/`-Logikänderung; bestehende `data-testid`-Selektoren bleiben
  stabil, damit Desktop-E2E-Tests unverändert laufen.

## 4. Testing

- Neue E2E-Spec `frontend/e2e/mobile-portrait.spec.ts` (Viewport 360×740,
  Mobil-User-Agent): kein vertikaler Scroll (`scrollHeight ≤ innerHeight`)
  auf Lobby-, Spiel- und Abrechnungs-Screen; Tap auf spielbare Karte,
  Ziehen und Aussteigen funktioniert.
- Keine neuen Vitest-Tests (keine Regellogik betroffen).
- Verifikations-Reihenfolge vor Push: `npm run lint` → `npm run build` →
  `npm test` → `npm run test:e2e`.

## Nicht-Ziele

- Kein Landscape-Layout, kein Drehen-Hinweis.
- Kein Kartenfächer mit Überlappung (verworfen: kleinere Tap-Flächen, mehr
  Komplexität).
- Keine generelle Neugestaltung des Desktop-Layouts.
