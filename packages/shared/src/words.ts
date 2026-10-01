/**
 * Word banks for word bursts. Short, common, no accents that need dead keys
 * (á, é… would require two key presses on most layouts).
 */
export const WORDS: Record<"es" | "en", readonly string[]> = {
  es: [
    "casa", "golpe", "tecla", "rapido", "fuego", "nube", "lluvia", "pelea", "ciudad", "barrio",
    "ladrillo", "torre", "puerta", "camion", "grua", "obrero", "martillo", "pintura", "tinta", "sello",
    "ruido", "trueno", "furia", "gloria", "duelo", "ritmo", "racha", "combo", "punto", "danza",
    "piso", "techo", "calle", "plaza", "mundo", "volcan", "rayo", "lobo", "zorro", "nieve",
    "año", "niño", "señal", "muñeca", "otoño", "sueño", "baño", "caña", "leña", "araña",
  ],
  en: [
    "house", "punch", "key", "quick", "fire", "cloud", "rain", "fight", "city", "block",
    "brick", "tower", "door", "truck", "crane", "worker", "hammer", "paint", "ink", "stamp",
    "noise", "thunder", "fury", "glory", "duel", "rhythm", "streak", "combo", "point", "dance",
    "floor", "roof", "street", "square", "world", "volcano", "bolt", "wolf", "fox", "snow",
    "jump", "zebra", "pixel", "quartz", "wizard", "jazz", "vivid", "boxer", "joker", "knock",
  ],
};
