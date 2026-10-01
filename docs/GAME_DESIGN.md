# KeyWar · Diseño del juego

> Pelea de tecleo online. Las teclas bajan por tu edificio al ritmo de la música; si las pulsas justo cuando tocan la línea de golpe, le quitas ladrillos (vida) a los edificios rivales. Gana el último edificio en pie.

Las reglas viven en código en `packages/shared` (`constants.ts`, `skills.ts`, `sim.ts`). Este documento explica el **porqué**; si un número no coincide, manda el código.

---

## 1. Bucle de una partida

```
Inicio → apodo + modo + dificultad + 2 herramientas → «¡A pelear!»
  → el cliente mide el ping a cada región y entra en la más rápida
  → cola: la sala se llena (3 o 6 obreros) → cuenta atrás de 5 s
  → partida de hasta 3 min, tempo creciente
  → resultados → «Otra pelea»
```

Objetivo de producto: **de la portada a estar tecleando en menos de 30 segundos.**

## 2. Modos

| Modo | Jugadores | Equipos | Cómo se gana |
|---|---|---|---|
| `ffa3` · 1 contra 1 contra 1 | 3 | cada uno el suyo | último edificio en pie |
| `team6` · 3 contra 3 | 6 | 2 | último equipo con alguien en pie |

Si se acaba el tiempo gana quien tenga **más vida total** (desempate: más daño hecho).
Salir a mitad de partida cuenta como derribo. Una caída de red da 20 s para reconectar.

## 3. Las notas («cajas»)

Cada nota es una **tecla física** (`KeyboardEvent.code`) más modificadores. Cae en la columna donde está esa tecla en el teclado, así que la pantalla te enseña dónde tienes que mirar con los dedos. Todos los jugadores de una sala reciben **la misma partitura** (misma semilla): la diferencia es pura habilidad.

| Caja | Color | Qué pide |
|---|---|---|
| Tecla | amarilla | pulsar la tecla |
| Mantener | celeste, con cuerda | mantenerla pulsada hasta que acabe la cuerda |
| Con Shift | verde, rótulo SHIFT | Shift + tecla (`?`, `!`, mayúsculas…) |
| Con Ctrl | roja, rótulo CTRL | Ctrl + tecla |
| Palabra | cajas unidas por una cuerda y rotuladas | cada letra en su golpe; bonus si la completas |

El color nunca va solo: Shift/Ctrl llevan rótulo, las palabras llevan cuerda y etiqueta.

**Niveles de dificultad** (se desbloquean con el tempo):
1. Fila central (`asdf jkl gh`)
2. Todas las letras
3. Números y palabras
4. Puntuación, símbolos con Shift, notas largas
5. Atajos con Ctrl y mayúsculas

**Teclas que nunca salen**, porque controlan el juego: `Espacio` (herramienta 1), `Enter` (herramienta 2), `Tab` (cambiar objetivo), `Esc` (salir).
**Atajos de Ctrl prohibidos**: `Ctrl+W/T/N/Q/Tab` (el navegador no deja interceptarlos). Solo se usan `Ctrl + A S D F G K Z X C V B`.
**Teclas muertas** (`´`, `` ` ``, `^`, `¨` en teclado español) tampoco salen: requieren dos pulsaciones.

## 4. Dificultad, ritmo y tempo

Antes de buscar partida eliges **dificultad**. Decide el ritmo entero de la sala, y el matchmaking **solo junta a jugadores con la misma dificultad** (y el mismo idioma).

| Dificultad | BPM (inicio → final) | Teclas/seg | Caída de las cajas | Ventanas (perfecto / bien / vale) | Teclas |
|---|---|---|---|---|---|
| **Tranquilo** | 70 → 95 | ~0,5 → 1 | 2,8 → 2,2 s | ±60 / ±120 / ±180 ms | sin atajos Ctrl; una tecla por tiempo siempre |
| **Normal** | 80 → 110 | ~0,6 → 1,7 | 2,4 → 1,7 s | ±50 / ±100 / ±150 ms | todo; corcheas solo en muerte súbita |
| **Experto** | 100 → 160 | ~1,1 → 2,6 | 1,7 → 1,1 s | ±40 / ±80 / ±120 ms | todo el teclado, corcheas siempre |

Cada partida pasa por 4 fases. En cada una sube el BPM, se desbloquean teclas más difíciles y las cajas caen más rápido:

| Fase | Desde | Daño | Novedad |
|---|---|---|---|
| Calentamiento | 0:00 | x1 | fila central |
| Hora punta | 0:45 | x1 | letras, números, palabras |
| Obras | 1:30 | x1,25 | símbolos, notas largas |
| Muerte súbita | 2:30 | **x2** | Ctrl y mayúsculas (salvo Tranquilo); el cielo se pone de atardecer |

Las notas se colocan sobre la misma rejilla que toca la música, así que nunca se desfasan del ritmo. Hoy suena un **ritmo sintetizado** sobre esa rejilla; la música real entra en la sección 9.

## 5. Precisión, racha y daño

**Ventanas de tiempo**: dependen de la dificultad (tabla de la sección 4). Una caja sin pulsar se cuenta como fallo poco después de la ventana de "vale".

**Pistas visuales del momento exacto**
- La zona de golpe muestra las tres franjas **a escala**: vale (arena), bien (celeste), perfecto (amarillo) y una línea de tinta en el instante exacto. Si el centro de la caja está en una franja, ese es tu resultado.
- Bajo cada caja que se acerca aparece su **marca de aterrizaje** punteada; se vuelve **verde** cuando ya puedes pulsar.
- La caja engrosa su borde en el instante perfecto.
- En el suelo-teclado, la tecla se pone **amarilla** cuando viene y **verde** mientras hay que pulsarla.

**Racha → multiplicador** (estilo Guitar Hero): 10 → x2 · 25 → x3 · 50 → x4. Fallar o pulsar una tecla sin caja **rompe la racha**, y pulsar en vacío además te quita 2 de vida (para que aporrear no salga a cuenta).

**Daño por golpe** = base × multiplicador × fase × bonos

- Base: perfecto 6 · bien 4 · vale 2
- Caja con Shift/Ctrl: ×1,5 · nota larga: ×1,5 (+ bonus al sostenerla entera)
- Palabra completa: +12 × multiplicador

**Vida**: 1000 por jugador, dibujada como 20 ladrillos de 50.

**Balance comprobado en simulación**: cada dificultad tiene un multiplicador de daño (Tranquilo x1,5 · Normal x0,85 · Experto x0,17) para compensar cuántas teclas caen. Así, con bots de su nivel, las partidas de las tres dificultades terminan entre los 2:00 y los 3:00.

### Objetivo

El daño va a tu **objetivo**. Por defecto es el rival **con más vida**: los que van ganando atraen el fuego y la partida no se rompe pronto. `Tab` (o clic en su edificio) cambia de objetivo.

## 6. Tinta y herramientas (habilidades)

La **tinta** (el depósito de agua del tejado, 0–100) se gana tecleando limpio: +5 por perfecto, +2 por bien, +15 cada 25 de racha. Antes de buscar partida eliges **2 herramientas**: `Espacio` usa la primera y `Enter` la segunda.

| Herramienta | Tipo | Coste | Efecto | Dura | Recarga |
|---|---|---|---|---|---|
| Hormigonera | sabotaje | 40 | vierte cemento sobre una franja del carril rival | 4 s | 8 s |
| Grúa turbo | sabotaje | 45 | sus cajas caen un 40 % más rápido (mismo ritmo, menos aviso) | 5 s | 10 s |
| Escaparate | sabotaje | 35 | ve las letras en espejo | 5 s | 9 s |
| Apagón | sabotaje | 50 | las cajas desaparecen en el último tramo | 4 s | 12 s |
| Letrero en mayúsculas | sabotaje | 60 | todas sus letras piden Shift | 6 s | 14 s |
| Martillo neumático | sabotaje | 30 | su edificio tiembla | 4 s | 8 s |
| Casco | propia | 30 | bloquea el próximo sabotaje | 15 s | 15 s |
| Goma | propia | 35 | 3 fallos sin perder la racha | 10 s | 15 s |
| Turno doble | propia | 70 | daño x2 | 8 s | 20 s |
| Ambulancia | equipo (3v3) | 60 | cura 120 al compañero más herido | — | 20 s |

**Reglas anti-frustración**
- Un jugador soporta como máximo **2 sabotajes a la vez**; un tercero reemplaza al que antes caduca.
- Repetir el mismo sabotaje alarga su duración, no lo apila.
- Ningún sabotaje hace una nota imposible: el ritmo y la tecla nunca cambian, solo lo que ves.
- Con «reducir movimiento» activo, el temblor se desactiva.

### Ideas para la siguiente tanda
- **Andamio**: tapa la fila de teclas del rival que más usa.
- **Camión de mudanzas**: intercambia dos columnas del carril rival durante 3 s.
- **Grafitero**: pinta una palabra señuelo sobre el carril (no cuenta, distrae).
- **Pararrayos**: devuelve el próximo sabotaje a quien lo lanzó.
- **Turno de noche** (3v3): todo tu equipo gana +1 de tinta por perfecto durante 10 s.

## 7. Búsqueda de sala por región

1. El cliente tiene una lista de regiones (`VITE_REGIONS`): una por servidor desplegado.
2. Al abrir la portada hace ping a todas en paralelo y elige la más rápida (el letrero muestra región y ms).
3. «¡A pelear!» hace `joinOrCreate` en esa región: entra en la sala abierta **más llena** del mismo modo, idioma y dificultad, o crea una.
4. Con la sala llena se bloquea y empieza la cuenta atrás.

Pendiente: si la cola de tu región tarda más de ~40 s, ofrecer la segunda región más rápida o rellenar con bots.

## 8. Idiomas y teclados

Interfaz y palabras en **español e inglés**; una sala es de un solo idioma. Español usa teclado ISO-ES (con `ñ`, `ç`, `<`), inglés usa US. Como las cajas son teclas físicas, el rótulo que ves sale de **tu** distribución de teclado.

## 9. Música (pendiente)

- Solo pistas **CC0 o propias**; nada con copyright, y evitar licencias que obliguen a atribuir en pantalla si no se diseña ese crédito.
- Cada pista necesita su BPM y sus cambios de tempo para generar la partitura encima.
- Mientras tanto suena el ritmo sintetizado (`apps/client/src/game/audio.ts`), alineado al mismo reloj que las cajas.

## 10. Abierto (por decidir)

- Cuentas, ranking (MMR) y progresión; hoy se juega como invitado.
- Salas privadas con código para jugar con amigos.
- Bots para rellenar colas con poca gente.
- Pantalla de calibración de latencia audio/teclado (el ajuste `inputOffsetMs` ya existe en el perfil).
- Monetización: ninguna decidida (cosméticos sería lo natural).
- Ilustraciones: obreros y vehículos en gouache para cada herramienta (hoy solo hay arquitectura y rótulos).
