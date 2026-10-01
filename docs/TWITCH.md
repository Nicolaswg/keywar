# KeyWar en Twitch: la batalla del chat

El streamer abre inscripciones; su chat escribe `!keywar`; los **primeros 100** entran (no hace falta llenar los 100); cuando el streamer pulsa **¡Empezar!**, todos pelean **todos contra todos** desde su navegador mientras el stream muestra la arena con el overlay de OBS.

> En Twitch los comandos que empiezan por `/` son del propio chat, por eso se usa `!keywar` (el nombre se puede cambiar en el panel).

## Cómo funciona

| Quién | Dónde | Qué hace |
|---|---|---|
| Streamer | `…/stream` | Entra con Twitch, elige idioma, dificultad, comando y máximo; abre inscripciones, ve quién está conectado, saca gente, empieza o cancela. Arriba del todo, siempre visible, **Parar todo** (pide confirmación). |
| Espectador | chat de Twitch | Escribe `!keywar` → queda inscrito (#1…#100; del 101 en adelante, lista de espera). |
| Espectador | `…/c/<canal>` | Entra con Twitch, espera en la sala (elige sus 2 herramientas) y juega cuando empieza. |
| OBS | `…/overlay/<canal>` | Fuente de navegador: inscripciones en vivo → arena con todos → podio. |
| Mods | chat de Twitch | `!kw abrir` · `!kw empezar` · `!kw cerrar` · `!kw cancelar` (solo mods y el streamer). |

**Parar todo** (el freno de emergencia del panel) termina la inscripción o la partida en curso, desconecta el chat y **cierra la sesión de todos los participantes** de ese canal: cualquier sesión iniciada antes de pulsarlo queda rechazada y tienen que volver a entrar. «Cancelar batalla», en cambio, solo termina la ronda.

**Al empezar** juegan los inscritos que tengan la web abierta, en orden de inscripción; si alguno de los 100 no apareció, su sitio pasa a la lista de espera conectada. Hacen falta al menos 2.

**Objetivo en cadena:** con 100 jugadores, todos se barajan en un anillo: cada uno ataca al siguiente y solo uno le ataca a él. Si cae tu objetivo, heredas el suyo. Tu pantalla muestra *tu objetivo* y *quién te ataca*, y el letrero «Quedan N». Gana el último en pie o, si se acaba el tiempo, quien tenga más vida.

## Probarlo en local

### 1 · Sin Twitch (modo de prueba)

```bash
DEV_FAKE_TWITCH=1 pnpm dev
```

O, para no tener que escribirlo cada vez, pon `DEV_FAKE_TWITCH=1` en `apps/server/.env` (local, no se sube a git) y usa `pnpm dev` normal. Si el panel dice «Twitch login is not configured», el servidor arrancó sin esa variable: reinícialo.

1. Abre http://localhost:5173/stream → **Entrar como streamer de prueba** → **Abrir inscripciones**.
2. En el **simulador de chat** del panel escribe usuario `ana`, mensaje `!keywar`, **Enviar**. Repite con otros nombres (el usuario se autoincrementa). Marca «es mod» y envía `!kw empezar` para probar los comandos de mod.
3. Abre http://localhost:5173/c/dev en otras pestañas (o ventanas de incógnito) y entra con el mismo nombre de prueba que inscribiste.
4. Abre http://localhost:5173/overlay/dev para ver el overlay.
5. Para llenar la sala sin abrir 100 pestañas:

   ```bash
   pnpm --filter @keywar/server loadtest -- --channel dev --bots 99
   ```

   Inscribe y conecta 99 bots; tú ocupas el puesto 100 y empiezas desde el panel. Con `--start` los bots arrancan y juegan la partida entera solos (útil como prueba de carga).

### 2 · Con Twitch de verdad, en tu PC

El chat se lee con **EventSub por WebSocket** usando la cuenta del propio streamer: no hace falta una cuenta bot ni una URL pública, así que funciona en `localhost`.

1. Crea una aplicación en https://dev.twitch.tv/console/apps
   - **OAuth Redirect URL:** `http://localhost:2567/auth/twitch/callback`
   - **Categoría:** Game Integration · **Tipo de cliente:** Confidencial
   - Copia el **Client ID** y genera un **Client Secret**.
2. Crea `apps/server/.env` (usa `apps/server/.env.example` como guía):

   ```bash
   TWITCH_CLIENT_ID=tu_client_id
   TWITCH_CLIENT_SECRET=tu_client_secret
   SESSION_SECRET=una_frase_larga_y_aleatoria
   PUBLIC_WEB_URL=http://localhost:5173
   PUBLIC_API_URL=http://localhost:2567
   ```

3. `pnpm dev` → http://localhost:5173/stream → **Entrar con Twitch** (autoriza leer y escribir en tu chat) → **Abrir inscripciones**. El panel debe mostrar «chat conectado».
4. Escribe `!keywar` en el chat de tu canal (no hace falta estar en directo; puedes usar una segunda cuenta). Aparece en el panel y KeyWar contesta en el chat con el enlace.
5. Abre http://localhost:5173/c/tu_canal y entra con esa cuenta.

### 3 · Con amigos, sin desplegar todavía

`localhost` solo existe en tu PC. Para que otros entren, abre dos túneles temporales:

```bash
cloudflared tunnel --url http://localhost:5173
cloudflared tunnel --url http://localhost:2567
```

Usa las URLs `https://…trycloudflare.com` que te dé:
- en `apps/server/.env`: `PUBLIC_WEB_URL` (la web) y `PUBLIC_API_URL` (el servidor),
- al arrancar la web: `VITE_REGIONS=local=wss://<url-del-servidor>`,
- y añade `https://<url-del-servidor>/auth/twitch/callback` como Redirect URL en tu app de Twitch.

## Añadir el overlay a OBS

1. En el panel, **Overlay para OBS → Copiar**.
2. OBS → Fuentes → **+** → **Navegador** → pega la URL. Ancho **1920**, alto **1080**.
3. ¿Fondo transparente para ponerlo encima de tu cámara o juego? Añade `&bg=0` al final de la URL.

## Producción

- Mismas variables que arriba con tus dominios reales (`PUBLIC_WEB_URL=https://keywar.tu-dominio`, `PUBLIC_API_URL=https://sa.keywar.tu-dominio`), y su Redirect URL en la app de Twitch.
- `SESSION_SECRET` es obligatorio en producción. `DEV_FAKE_TWITCH` se ignora siempre con `NODE_ENV=production`.
- Una batalla vive en el servidor de la región que elige el streamer en el panel; los enlaces llevan `?r=<región>` para que todos entren al mismo.
- Capacidad medida en local: 100 jugadores en una sala ≈ 4 % de CPU de media, ~115 MB de RAM y ~0,2 MB/s de tráfico total.
