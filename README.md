# DMARC Analyzer
AI-drevet analyseverktøy for DMARC-rapporter. Last opp en `.xml.gz` fil og få en konkret anbefaling fra Claude.

## Kom i gang

### Forutsetninger
- Docker og Docker Compose installert
- En Anthropic API-nøkkel fra [console.anthropic.com](https://console.anthropic.com)

### Kjør med Docker Compose
```powershell
# Sett API-nøkkel
$env:ANTHROPIC_API_KEY = "sk-ant-..."
# Start
docker compose up -d
```

### Kjør med Docker direkte
```powershell
docker build -t dmarc-analyzer .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... dmarc-analyzer
```

## Bruk
1. Åpne `http://localhost:3000`
2. Dra og slipp en DMARC XML-rapport (`.xml.gz` eller `.xml`)
3. Se oversikten over sendere og pass-rate
4. Trykk **Analyser med Claude AI** for anbefaling

## Miljøvariabler
| Variabel | Beskrivelse | Standard |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | API-nøkkel fra Anthropic (påkrevd) | — |
| `PORT` | Port appen lytter på | `3000` |