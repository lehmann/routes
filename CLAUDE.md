# Routes — Guia para Claude

## O que é este projeto

Planejador de rotas de transporte público com paradas intermediárias programadas e restrições de horário. O diferencial é o algoritmo de **backward propagation** em `app/lib/planner.ts` — ele resolve restrições de tempo trabalhando de trás para frente a partir do deadline final.

Inclui também o **Trilheiro**: visualização de trilhas GPX com funcionamento offline, em `app/components/TrailMode.tsx`.

## Arquitetura

- **OTP2 v2.11** (Docker, porta 8080) — motor de roteamento, API GraphQL em `/otp/gtfs/v1`
- **Next.js 16** (`app/`) — frontend React + API Routes
- **`/api/plan`** (POST) — endpoint principal; orquestra o planner
- **`lib/otp.ts`** — cliente GraphQL para o OTP2 (`planLeg` via `planConnection`)
- **`lib/planner.ts`** — `planRoute()`: backward propagation ou forward planning
- **`components/RouteMap.tsx`** — mapa MapLibre com marcadores e linhas de rota por modo
- **`components/PlaceSearch.tsx`** — autocomplete de lugares via Nominatim (OSM)
- **`components/TrailMode.tsx`** / **`TrailMap.tsx`** — Trilheiro (lista de GPX, GPS e mapa das trilhas)
- **`lib/gpx-store.ts`** — GPX salvos no IndexedDB (`routes` / `gpx`)
- **`public/sw.js`** — service worker (versão atual `v4`)

## Algoritmos de planejamento

### Backward propagation (`arriveBy` definido)
Dado `waypoints[]` e `arriveByDeadline`:
1. Itera de trás para frente (último segmento primeiro)
2. Para cada perna, chama OTP2 com `dateTime: { latestArrival }` e o deadline corrente
3. Escolhe o itinerário com a **partida mais tardia** (maximiza flexibilidade para pernas anteriores)
4. Deadline propagado: `departure_time - stopDurationMinutes`
5. Se o waypoint tiver `arriveBy` explícito, usa `min(propagado, explícito)`
6. Se `leaveBy` também estiver definido, emite warning se a partida calculada ultrapassar o limite

### Forward planning (`leaveBy` sem `arriveBy`)
1. Itera de frente para trás
2. Para cada perna, chama OTP2 com `dateTime: { earliestDeparture }`
3. Escolhe o itinerário com a **chegada mais cedo**
4. Próxima partida: `arrival_time + stopDurationMinutes` do destino
5. Se waypoint intermediário tiver `arriveBy`, emite warning se não for cumprível

## API GraphQL do OTP2 v2.11

**Endpoint:** `POST http://localhost:8080/otp/gtfs/v1`  
**Explorer:** `http://localhost:8080/graphiql`

Pontos de atenção:
- Query: `planConnection` (não `plan`) — retorna Relay connection (`edges[].node`)
- Coordenadas: tipo `CoordinateValue!` (não `Float!`) nas variáveis GraphQL
- DateTime: `PlanDateTimeInput` com `latestArrival` ou `earliestDeparture` (tipo `OffsetDateTime` — ISO 8601 com offset obrigatório, ex: `2026-09-20T10:00:00+02:00`)
- Horários de legs na resposta: milissegundos epoch (converter com `new Date(ms).toISOString()`)
- `start`/`end` do itinerário: ISO string direta

## O que NÃO fazer

- Não adicionar diferenciação de tarifas — fora do escopo atual
- Não trocar o algoritmo de backward propagation por forward search quando `arriveBy` estiver definido
- Não usar `--load --serve` no Docker antes de `otp-data/graph.obj` existir
- Não usar `Float!` para coordenadas nas variáveis GraphQL — usar `CoordinateValue!`
- Não atualizar o **MapLibre GL para 6.x**: fixado em 5.x (`^5.24.0`). Com a 6.10 os tiles não eram pedidos e o Chrome acusava `Failed to load module script`
- Não guardar HTML sob uma URL de script ou asset no service worker
- Não fazer **commit, push ou PR** sem pedido explícito do usuário

## Comandos úteis

```bash
# Subir OTP2
docker compose up

# Frontend (requer Node 20 via nvm)
cd app && nvm use && npm run dev

# Container do frontend (porta 7201) — o único jeito de testar o service worker localmente
docker compose build app && docker compose up -d app

# Testar OTP2 via GraphQL
curl -s http://localhost:8080/otp/gtfs/v1 -X POST -H "Content-Type: application/json" \
  -d '{"query":"{ planConnection(origin:{location:{coordinate:{latitude:52.5219,longitude:13.4132}}}, destination:{location:{coordinate:{latitude:52.5096,longitude:13.3761}}}, dateTime:{latestArrival:\"2026-09-20T11:00:00+02:00\"}, first:2) { edges { node { start end legs { mode route { shortName } } } } } }"}' \
  | python3 -m json.tool

# Atualizar GTFS
curl -L -o otp-data/vbb-gtfs.zip https://unternehmen.vbb.de/gtfs
```

## Configuração do OTP2

| Arquivo | Propósito |
|---|---|
| `otp-data/build-config.json` | Timezone Europe/Berlin, período 7d atrás–90d à frente |
| `otp-data/router-config.json` | 5 itinerários por query, walkSpeed 1.4 m/s |
| `docker-compose.yml` | `-Xmx6g`, `mem_limit: 8g`, `G1GC` (OTP); app na porta 7201 |

## Mapa (MapLibre GL)

- Versão fixada em **5.x**; o `react-map-gl` é a 8.x
- CSS do MapLibre importado em `app/globals.css` via `@import` — NÃO importar dentro de client components
- O `<Map>` usa `style={{ position: 'absolute', inset: 0 }}` para preencher o container flex corretamente
- Estilo de mapa: CARTO Voyager (`https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json`) — sem API key
- Polylines das pernas decodificados via algoritmo Google Encoded Polyline embutido em `RouteMap.tsx`

## Layout

- Raiz em `h-dvh`; abaixo de `md` (768px) o painel fica empilhado acima do mapa, com `55dvh`
- Desktop: painel de 520px à esquerda, mapa no resto

## Trilheiro e service worker

- Ocultar/exibir trilhas é persistido em `localStorage` (`routes-trail-hidden`), para sobreviver a sair e voltar ao modo
- `public/sw.js`: não é registrado em dev (só em produção). Navegação em rede primeiro, com `/` em cache como fallback; `/_next/static/` e tiles CARTO em cache-first; o restante passa direto para a rede
- Ao alterar o `sw.js`, incremente `VERSION` (o `activate` apaga caches antigos) e faça Unregister do worker antigo no navegador para testar

## Geocoding (Nominatim)

- Endpoint: `https://nominatim.openstreetmap.org/search`
- Parâmetros: `format=json&limit=5&countrycodes=de&accept-language=de`
- Debounce de 400ms para respeitar a política de uso da API (sem API key, sem rate limit agressivo)
- User-Agent obrigatório: `Berlin-Transit-Planner/1.0`

## Dados

- `otp-data/berlin.osm.pbf` — OSM Berlin (Geofabrik, ~95 MB)
- `otp-data/vbb-gtfs.zip` — GTFS VBB Berlin-Brandenburg (~73 MB, atualizado 2x/semana)
- `otp-data/graph.obj` — grafo compilado (gerado pelo OTP2, não commitado)
