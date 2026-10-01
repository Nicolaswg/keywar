import { defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@keywar/shared";
import { MatchRoom } from "./rooms/MatchRoom.js";

const port = Number(process.env.PORT) || 2567;
const region = process.env.REGION ?? "local";

/**
 * One process = one region. Players with the same language and difficulty
 * queue into the same open room, and the fullest open room fills first.
 */
const server = defineServer({
  transport: new WebSocketTransport(),
  rooms: {
    [ROOM_NAME.ffa3]: defineRoom(MatchRoom, { mode: "ffa3" }).filterBy(["lang", "difficulty"]).sortBy({ clients: -1 }),
    [ROOM_NAME.team6]: defineRoom(MatchRoom, { mode: "team6" }).filterBy(["lang", "difficulty"]).sortBy({ clients: -1 }),
  },
  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({ ok: true, region });
    });
  },
});

await server.listen(port);
console.log(`KeyWar server · region ${region} · ws://localhost:${port}`);
