# KeyWar · Arquitectura

## Monorepo

```
keywar/
├─ packages/shared     Reglas del juego, sin dependencias de red
│   ├─ constants.ts    modos, fases de tempo, ventanas de juicio, daño, tinta
│   ├─ keys.ts         modelo de teclado (posición física + rótulos ES/US)
│   ├─ chart.ts        generador de partitura determinista por semilla
│   ├─ judge.ts        juicio de tiempo, daño, tinta
│   ├─ skills.ts       catálogo de herramientas
│   ├─ sim.ts          MatchSim: la partida autoritativa
│   └─ protocol.ts     contrato cliente ↔ servidor
├─ apps/server         Colyseus: matchmaking + sincronía de estado (adaptador fino de MatchSim)
└─ apps/client         Vite + React: pantallas en DOM, carril en Canvas 2D
    ├─ src/styles      tokens.css (design system) + base.css
    ├─ src/ds          componentes del design system
    ├─ src/net         GameSession: OnlineSession (Colyseus) y PracticeSession (bots locales)
    ├─ src/game        LaneController (input + juicio local), draw.ts (canvas), audio.ts
    └─ src/screens     Home, MatchFlow (cola/partida/resultados), DesignSystem (?ds)
```

## Una sola implementación de las reglas

`MatchSim` (shared) contiene toda la lógica: asientos, cuenta atrás, barrido de fallos, daño, objetivo, herramientas y fin de partida. Trabaja sobre interfaces (`SimState`, `SimPlayer`) que cumplen tanto los objetos de esquema de Colyseus como objetos planos. Por eso:

- **Servidor**: `MatchRoom` crea el `MatchSim` sobre su `MatchState` sincronizado y le pasa los mensajes.
- **Práctica**: `PracticeSession` ejecuta el mismo `MatchSim` en el navegador con bots.

Cambiar una regla = cambiarla una vez, con tests (`packages/shared/src/*.test.ts`).

## Partitura determinista

El servidor elige una `seed` y la sincroniza; cada cliente llama a `generateChart(seed, lang)` y obtiene exactamente las mismas notas. La partitura (~400 notas) nunca viaja por la red.

## Tiempo y anti-trampas

```
cliente                                   servidor
  ── clock {c: t_local} ───────────────▶
  ◀────────────── clock {c, s: t_server}
  offset = s − (c + rtt/2)  (muestra con menor RTT de una ráfaga)
  matchNow = ahora + offset − startsAt
```

1. El cliente juzga **localmente** para dar respuesta instantánea y envía `hit {noteId, offset}`.
2. El servidor vuelve a juzgar con ese offset y comprueba que sea **plausible**: la pulsación declarada (`note.t + offset`) debe estar en el pasado reciente (≤ 600 ms) y no en el futuro.
3. Las notas sin golpe se barren como fallo 300 ms después de su ventana (margen de red).
4. Vida, daño, tinta, herramientas y ganador **solo los calcula el servidor**.

Límite: un cliente modificado podría mentir sobre el offset dentro de la ventana. Mitigaciones previstas: análisis estadístico de offsets por jugador (demasiado perfecto = sospechoso), límite de mensajes (`maxMessagesPerSecond = 60`) y cuentas/ranking antes de premiar nada.

## Batallas del chat de Twitch

- **`RoyaleRoom`** (una sala por canal, `filterBy(["channel"])`): estado de inscripción (`entrants`, `stage`, `command`, `remaining`) + el mismo `MatchSim` en modo `royale` (objetivo en anillo). `patchRate` 100 ms.
- **Eventos dirigidos:** `MatchSim` emite `damage` y `skillCast` con `host.notify(ids)`. Las salas de 3–6 los difunden a todos; `RoyaleRoom` solo los manda a los dos implicados y a los espectadores (overlay/panel). `knockout` sí va a todos.
- **Login:** OAuth de Twitch (authorization code) en `apps/server/src/twitch/routes.ts`; el servidor firma un token de sesión propio (HMAC, `SESSION_SECRET`). Streamer pide `user:read:chat` y `user:write:chat`; el jugador, ningún permiso.
- **Chat:** `ChatListener` se conecta a EventSub por WebSocket con el token del streamer y se suscribe a `channel.chat.message`. Cada línea pasa por `parseChatCommand` (shared, con tests) → `registry.handleChat`. El simulador de chat del modo dev entra por el mismo `handleChat`.
- **Medido:** 100 jugadores en una sala ≈ 4 % CPU media, ~115 MB, ~0,2 MB/s (`pnpm --filter @keywar/server loadtest -- --bots 100 --start`).

## Mensajes

| Dirección | Tipo | Carga |
|---|---|---|
| C → S | `hit` | `{noteId, offset}` |
| C → S | `holdEnd` | `{noteId, heldMs}` |
| C → S | `wrong` | `{}` |
| C → S | `skill` | `{slot: 0 \| 1}` |
| C → S | `target` | `{sessionId}` |
| C → S | `clock` | `{c}` |
| S → C | `clock` | `{c, s}` |
| S → C | `judged` | `{noteId, judgement, damage, targetId}` (solo al que golpeó) |
| S → C | `skillCast` | `{from, to, skill, blocked}` (a todos) |
| S → C | `damage` | `{from, to, amount}` (anima el ladrillo que cae; en batallas del chat solo a los implicados) |
| S → C | `knockout` | `{victim, by, remaining}` (a todos; feed del overlay) |

El resto (vida, racha, tinta, efectos activos, fase, ganador) va en el **estado sincronizado** (`apps/server/src/rooms/schema.ts`).

## Regiones y despliegue (Dokploy)

- **Un proceso de servidor = una región.** Se despliega el mismo `docker-compose.yml` en cada VPS regional con `REGION=sa-east`, `REGION=us-east`, etc.
- El cliente es estático (nginx) y conoce las regiones por `VITE_REGIONS` en el build.
- Matchmaking: `filterBy(["lang", "difficulty"])` + `sortBy({clients: -1})` llena primero la sala más avanzada.
- Para escalar **dentro** de una región con varios procesos: añadir `@colyseus/redis-presence` y `@colyseus/redis-driver` (Redis compartido); no hace falta tocar `MatchRoom`.
- Salud: `GET /health` → `{ ok, region }`.

## Rendimiento del cliente

- El carril se pinta en **Canvas 2D** a 60 fps; React solo re-renderiza el HUD (~5 veces por segundo para el reloj, y en cada cambio de estado).
- Las teclas del suelo-teclado se iluminan por manipulación directa de `data-state`, sin re-render de React.
- El audio se programa en `AudioContext` contra el reloj de partida, con 180 ms de antelación.

## Siguientes pasos técnicos

1. Música CC0 + mapa de BPM por pista → `generateChart` acepta la pista.
2. Bots en servidor para rellenar colas (reusar el `driveBots` de `PracticeSession`).
3. Salas privadas (`create` con código + `joinById`).
4. Pantalla de calibración que escriba `inputOffsetMs`.
5. Cuentas + MMR (filtrar matchmaking por rango).
