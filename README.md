# BENRA Sarepta Prototype

Teknisk prototype utviklet av BENRA AS for å demonstrere sentrale prinsipper for en ny webbasert Sarepta-løsning.

## Formål

Prototypen viser:

- React-basert webgrensesnitt
- enkel voksenmodus for å opprette tekstinnhold
- enkel elevmodus
- tilgjengelig tastatur-/bryternavigasjon
- innebygd talesyntese via nettleser/operativsystem
- autosave i nettleseren
- tydelig fokusmarkering og semantisk HTML
- foreslått Python/Django-backend
- Docker-oppsett

Dette er en **teknisk prototype**, ikke ferdig løsningsdesign. Endelige valg for autentisering, database, lagring, talesyntese og driftsmiljø må avklares med Statped.

## Kjør frontend lokalt

```bash
cd frontend
npm install
npm run dev
```

## Kjør med Docker

```bash
docker compose up --build
```

Frontend: http://localhost:5173  
Backend: http://localhost:8000

## Tilgjengelighet

Prototypen er laget for å kunne testes med tastatur og skjermleser. Bryterstyring simuleres gjennom konfigurerbare tastetrykk.

Standard:
- `ArrowRight` / `Space`: neste
- `ArrowLeft`: forrige
- `T`: les opp

## Demo og avgrensning

GitHub Pages deployer frontend som en statisk demo. Django-backend er inkludert for å vise foreslått arkitektur, men er ikke nødvendig for den statiske demoen.

Se `docs/architecture.md` og `docs/accessibility.md`.
