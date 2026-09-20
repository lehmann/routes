# Routes — Transit Planner

Planejador de rotas de transporte público com suporte a **paradas intermediárias programadas** e restrições de horário de chegada e partida.

## Conceito

Dado um trajeto A → B → C com:
- parada de 30 minutos em B (com deadline de chegada em B opcional)
- chegada em C até as 11:00

O sistema calcula o melhor conjunto de linhas de transporte público que satisfaz essas restrições. Dois modos de planejamento:

- **Backward propagation** (padrão quando `arriveBy` é definido): trabalha de trás para frente a partir do deadline final
- **Forward planning** (quando apenas `leaveBy` é definido): encadeia pernas a partir do horário de partida

## Stack

| Componente | Tecnologia |
|---|---|
| Routing engine | OpenTripPlanner 2.11 (Docker) |
| API do OTP2 | GraphQL (`planConnection`) |
| Dados de trânsito | VBB GTFS (Berlin-Brandenburg) |
| Dados de mapa | OpenStreetMap (Geofabrik) |
| Geocoding | Nominatim (OpenStreetMap, sem API key) |
| Frontend + API | Next.js 14 (TypeScript, Tailwind) |
| Mapa interativo | MapLibre GL + react-map-gl |

## Setup

### 1. Pré-requisitos

- Docker Desktop com pelo menos **9 GB de RAM** alocados (Settings → Resources → Memory)
- Node.js 20+ (use `nvm` — o projeto tem `.nvmrc` com versão 20)

### 2. Dados (já baixados em `otp-data/`)

| Arquivo | Fonte |
|---|---|
| `otp-data/berlin.osm.pbf` | Geofabrik — Berlin extract (~95 MB) |
| `otp-data/vbb-gtfs.zip` | `https://unternehmen.vbb.de/gtfs` (~73 MB) |

### 3. Variáveis de ambiente

```bash
echo "OTP_URL=http://localhost:8080/otp/gtfs/v1" > app/.env.local
```

### 4. Subir o OTP2

```bash
docker compose up
```

Na **primeira execução**, o OTP2 compila o grafo de roteamento (~5–10 min, requer ~8 GB heap). O grafo é salvo em `otp-data/graph.obj`. Nas execuções seguintes, use `--load --serve` em `docker-compose.yml` para carregamento rápido (~30 s).

Aguarde: `Grizzly server running`.

### 5. Subir o frontend

```bash
cd app
nvm use          # ativa Node 20 via .nvmrc
npm install
npm run dev
```

Acesse: `http://localhost:3000`

### 6. Explorar a API do OTP2

GraphiQL embutido: `http://localhost:8080/graphiql`

## Estrutura do projeto

```
routes/
├── docker-compose.yml           # OTP2 (porta 8080, -Xmx6g, mem_limit 8g)
├── otp-data/
│   ├── berlin.osm.pbf           # dados OSM Berlin
│   ├── vbb-gtfs.zip             # GTFS VBB Berlin-Brandenburg
│   ├── build-config.json        # timezone Europe/Berlin, período 7d–90d
│   └── router-config.json       # 5 itinerários, walkSpeed 1.4 m/s
└── app/                         # Next.js 14
    ├── components/
    │   ├── RouteMap.tsx          # mapa MapLibre com marcadores e linhas de rota
    │   └── PlaceSearch.tsx       # busca de lugares via Nominatim com autocomplete
    ├── lib/
    │   ├── otp.ts               # cliente GraphQL do OTP2 (planConnection)
    │   └── planner.ts           # backward propagation + forward planning
    └── app/
        ├── api/plan/route.ts    # POST /api/plan
        └── page.tsx             # UI: layout duas colunas (formulário + mapa)
```

## API

### `POST /api/plan`

Pelo menos um de `arriveBy` ou `leaveBy` é obrigatório.

```json
{
  "waypoints": [
    { "label": "Alexanderplatz", "lat": 52.5219, "lon": 13.4132 },
    {
      "label": "Checkpoint Charlie",
      "lat": 52.5075, "lon": 13.3904,
      "stopDurationMinutes": 30,
      "arriveBy": "2026-09-20T10:30:00Z"
    },
    { "label": "Potsdamer Platz", "lat": 52.5096, "lon": 13.3761 }
  ],
  "arriveBy": "2026-09-20T11:00:00Z",
  "leaveBy": "2026-09-20T09:00:00Z"
}
```

**Campos do waypoint:**
| Campo | Tipo | Descrição |
|---|---|---|
| `label` | string | Nome do ponto |
| `lat`, `lon` | number | Coordenadas GPS |
| `stopDurationMinutes` | number? | Duração da parada (apenas intermediários) |
| `arriveBy` | ISO string? | Chegar a este ponto até este horário |

**Resposta:**
```json
{
  "feasible": true,
  "totalDuration": 42,
  "legs": [
    {
      "from": { "label": "...", "lat": ..., "lon": ... },
      "to": { "label": "...", "lat": ..., "lon": ... },
      "stopAfter": 30,
      "itinerary": {
        "startTime": "...", "endTime": "...", "duration": ...,
        "legs": [{ "mode": "RAIL", "route": "S7", "headsign": "...", ... }]
      }
    }
  ],
  "warnings": []
}
```

## Atualizar dados GTFS

O VBB publica atualizações 2x por semana:

```bash
curl -L -o otp-data/vbb-gtfs.zip https://unternehmen.vbb.de/gtfs
# Recompilar: alterar docker-compose.yml para ["--build", "--save", "--serve"]
docker compose up
# Após compilar, restaurar para ["--load", "--serve"]
```
