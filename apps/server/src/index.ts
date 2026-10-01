import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@keywar/shared";
import { config, twitchEnabled } from "./config.js";
import { MatchRoom } from "./rooms/MatchRoom.js";
import { RoyaleRoom } from "./rooms/RoyaleRoom.js";
import { mountTwitchRoutes } from "./twitch/routes.js";

const { port, region } = config;

/**
 * One process = one region. Players with the same language and difficulty
 * queue into the same open room, and the fullest open room fills first.
 */
const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: {
    [ROOM_NAME.duel]: defineRoom(MatchRoom, { mode: "duel" }).filterBy(["lang", "difficulty"]).sortBy({ clients: -1 }),
    [ROOM_NAME.ffa3]: defineRoom(MatchRoom, { mode: "ffa3" }).filterBy(["lang", "difficulty"]).sortBy({ clients: -1 }),
    [ROOM_NAME.team6]: defineRoom(MatchRoom, { mode: "team6" }).filterBy(["lang", "difficulty"]).sortBy({ clients: -1 }),
    // Twitch chat battles: one room per channel, created from the streamer panel.
    [ROOM_NAME.royale]: defineRoom(RoyaleRoom).filterBy(["channel"]),
  },
  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({ ok: true, region });
    });
    mountTwitchRoutes(app);
  },
});

await server.listen(port);
console.log(`KeyWar server · region ${region} · ws://localhost:${port}`);
console.log(`Twitch: ${twitchEnabled() ? "login on" : "login off (no TWITCH_CLIENT_ID)"}${config.devTwitch ? " · DEV fake identities + chat simulator ON" : ""}`);
