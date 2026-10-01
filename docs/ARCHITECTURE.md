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
| S → C | `damage` | `{from, to, amount}` (a todos; anima el ladrillo que cae) |

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
