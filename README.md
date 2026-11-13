# Sudoku

En rolig sudoku-app på dansk til telefonen. Den kører direkte i browseren (ingen App Store), kan lægges på hjemmeskærmen på både iPhone og Android og virker uden internet.

**Spil her:** https://christianhornskov.github.io/sudoku/

## Det kan appen
- **Fire sværhedsgrader** (Let, Mellem, Svær, Ekspert). Sværheden afgøres af, hvilke løseteknikker gåden kræver, og ikke kun af hvor mange tal der er givet. Alle gåder har præcis én løsning.
- **Rigtigt tal eller blyant:** Knappen *Blyant* skifter til små notater, så du kan skrive flere mulige tal i samme felt (fx både 1 og 2). Når du sætter et rigtigt tal, forsvinder det automatisk fra notaterne i rækken, kolonnen og boksen (kan slås fra).
- **Hint, der forklarer hvorfor:** Første tryk giver et vink om, hvor du skal kigge. Næste tryk forklarer teknikken på dansk og viser felterne, og til sidst kan appen sætte tallet ind (eller fjerne kandidater). Står der et forkert tal på pladen, siger hintet det først.
- Fortryd, viskelæder, auto-notater, fejlmarkering (valgfri), timer med pause, fremhævning af samme tal og række/kolonne/boks.
- Gemmer spillet automatisk. Lyst og mørkt udseende efter telefonens indstilling.

## Teknikker i hint-motoren
Nøgen enkelt, skjult enkelt, nøgent par/tripel/firer, skjult par/tripel/firer, pegende par/tripel, boks/linje-reduktion, X-Wing, Swordfish, XY-Wing og XYZ-Wing. Hvis ingen teknik passer, forklarer hintet det og viser det næste felt.

| Niveau | Kræver højst |
|---|---|
| Let | nøgen og skjult enkelt |
| Mellem | + nøgent par, pegende par, boks/linje |
| Svær | + skjult par, nøgen/skjult tripel, X-Wing |
| Ekspert | + XY-Wing, XYZ-Wing, Swordfish, firere |

## Læg den på hjemmeskærmen
- **iPhone (Safari):** åbn linket → tryk **Del** (firkant med pil op) → **Føj til hjemmeskærm**.
- **Android (Chrome):** åbn linket → tryk på menuen (tre prikker) → **Installer app** / **Føj til startskærm**.

## Filer
`index.html`, `style.css`, `app.js` (brugerflade), `engine.js` (generator, løser, teknikker), `hints.js` (hint-tekster), `worker.js` (genererer gåder i baggrunden), `sw.js` + `manifest.webmanifest` (offline og installation), `icons/`.
Ingen build-trin og ingen afhængigheder. Åbn `index.html` via en lokal webserver (fx `python3 -m http.server`).

## Test
- `node tests/engine.test.js` – entydighed, gradering og hint-motorens korrekthed (hvert hint-trin kontrolleres mod facit).
- `python3 tests/ui.py`, `tests/layout.py`, `tests/pwa.py` – browsertests med Playwright (skærmbilleder i `screenshots/`).
