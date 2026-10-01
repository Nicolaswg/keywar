# KeyWar

Pelea de tecleo online y gratis. Las teclas (letras, símbolos, atajos con Shift y Ctrl) bajan por tu edificio al ritmo de la música. Si las pulsas justo cuando tocan la línea de golpe, le quitas ladrillos a los edificios rivales. Con rachas haces más daño, y con tinta usas herramientas para sabotear a los demás. Hay salas de 3 (1 contra 1 contra 1) y de 6 (3 contra 3), y la búsqueda de sala va por región.

- **Diseño del juego**: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)
- **Arquitectura**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Batalla del chat de Twitch** (hasta 100, `!keywar`): [docs/TWITCH.md](docs/TWITCH.md)
- **Producto**: [PRODUCT.md](PRODUCT.md) · **Design system**: [DESIGN.md](DESIGN.md) y la página viva en `http://localhost:5173/?ds`

## Arrancar en local

Requisitos: Node 22+ y pnpm 11.

```bash
pnpm install
pnpm dev
```

- Cliente: http://localhost:5173
- Servidor de juego: ws://localhost:2567 (`/health` para comprobarlo)
- Sin servidor también se puede jugar: **«Practicar con bots»** ejecuta las mismas reglas en el navegador.

Para probar online tú solo, arranca el servidor con una sala que empiece incompleta:

```bash
MIN_PLAYERS=1 FILL_TIMEOUT_MS=3000 pnpm dev:server
```

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | cliente y servidor con recarga |
| `pnpm test` | tests de reglas (`packages/shared`) |
| `pnpm typecheck` | TypeScript en todo el monorepo |
| `pnpm build` | build de producción |

## Estructura

```
packages/shared   reglas del juego (partitura, juicio, daño, herramientas, MatchSim)
apps/server       Colyseus: matchmaking por idioma y estado sincronizado
apps/client       Vite + React; carril en Canvas 2D; design system en src/styles + src/ds
```

## Despliegue (Dokploy)

Monta una pila `docker-compose.yml` por región:

```bash
REGION=sa-east VITE_REGIONS="sa-east=wss://sa.keywar.example,us-east=wss://us.keywar.example" docker compose up -d --build
```

- `server`: servidor de juego de esa región (puerto 2567, necesita WebSocket/`wss` detrás del proxy).
- `web`: cliente estático (nginx). Basta con desplegarlo en una sola región.
- El cliente hace ping a todas las regiones de `VITE_REGIONS` y entra en la más rápida.

## Controles

| Tecla | Acción |
|---|---|
| la tecla de la caja | golpear (con Shift/Ctrl si la caja lo pide) |
| `Espacio` / `Enter` | herramienta 1 / herramienta 2 |
| `Tab` | cambiar de objetivo |
| `Esc` | salir de la partida |
