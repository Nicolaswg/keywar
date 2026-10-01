# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

pnpm monorepo, TypeScript end to end.
- Client: Vite + React; the falling-key lane is drawn on Canvas 2D (React only owns the shell, HUD and menus).
- Server: Node + Colyseus (rooms, matchmaking, authoritative state sync over WebSocket).
- Shared package: game rules, timing windows, skill catalogue, word banks — imported by both sides so they never drift.
- Deploy: Dokploy on own VPS, one Docker compose stack per region. The client pings every regional endpoint and joins the lowest-latency one.

## Users

Free-to-play web players who want a short, loud, competitive typing fight with friends or strangers. They arrive from a shared link or a search, pick a nickname and want to be in a match within seconds. Mostly desktop with a physical keyboard; the game requires one.

## Product Purpose

KeyWar is an online typing brawl. Letters and words fall down a lane to the beat of royalty-free music; hitting the right key when it crosses the hit line deals damage to opponents. Tempo rises through the match. Last player (or team) standing wins.

Success: a player goes from landing on the site to typing in a live match in under 30 seconds, and wants a rematch.

## Positioning

Typing-speed sites (Monkeytype, TypeRacer) measure you against a clock; rhythm games (osu!, Guitar Hero) measure you against a chart. KeyWar makes the chart a weapon: accuracy and timing turn into damage, combos charge skills, and skills sabotage the other players' lanes in real time.

## Operating Context

- Session: land → nickname → "Find match" → region ping → queue → countdown → 2–4 minute match → results → rematch/queue again.
- Modes: Free-for-all of 3 (1v1v1) and Teams of 6 (3v3).
- Queue search starts in the nearest region and the player's chosen language.
- Played with headphones/speakers on; audio is part of the timing feedback.

## Capabilities and Constraints

- Guest-first: nickname only, no account required. Accounts, ranking and progression come later (undecided).
- Bilingual UI and word banks: Spanish and English. A room is single-language.
- Music must be royalty-free / CC0 or original; nothing copyrighted.
- Server is authoritative for damage, skills, HP and match outcome; clients judge timing locally against a shared clock and report hits, the server validates them.
- Physical keyboard required; mobile shows a "needs a keyboard" state rather than a degraded game.
- Undecided: monetisation, ranked MMR, cosmetics, custom/private rooms (planned soon after MVP).

## Brand Commitments

Name: KeyWar. No logo or brand assets exist yet.

## Evidence on Hand

None. No players, testimonials, stats or music licensed yet; do not fabricate any.

## Product Principles

1. Seconds to fight: every screen before the match is an obstacle; remove it or make it instant.
2. Skill decides, sabotage spices: skills disrupt but never make a match unwinnable for the better typist.
3. Readable under pressure: the lane must stay legible at max tempo and under every sabotage effect.
4. Fair by construction: the server owns the outcome; latency is compensated, not exploited.
5. The beat is the clock: music, visuals and judgement share one timeline.

## Accessibility & Inclusion

- Colour is never the only carrier of meaning (team, judgement, skill state also use shape/label).
- Reduced-motion setting tones down screen shake and flashes; sabotage effects that flash must respect it.
- Adjustable audio/visual offset calibration, lane scroll speed preference and high-contrast lane option.
