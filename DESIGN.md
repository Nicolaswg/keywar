---
name: KeyWar
description: A Busytown cross-section typing brawl; every player is a cutaway building, keys ride down its floors and get stamped on the keyboard floor.
colors:
  paper: "#f8f3e8"
  paper-shade: "#efe6d3"
  ink: "#4a2e1c"
  ink-soft: "#6f4f38"
  brick: "#c8402f"
  brick-deep: "#9b2e21"
  bus: "#f5c518"
  bus-deep: "#d9a800"
  grass: "#4e9a3f"
  grass-deep: "#37772b"
  sky: "#9fd0f0"
  sky-deep: "#2f6fae"
  sky-wash: "#cfe6f4"
  sand: "#e4bd85"
  sand-deep: "#c99a5c"
  cement: "#9b958a"
  road: "#b9b2a4"
typography:
  display:
    fontFamily: "Shantell Sans Variable, Shantell Sans, cursive"
    fontSize: "clamp(3.5rem, 8vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "\"INFM\" 100, \"BNCE\" 0"
  headline:
    fontFamily: "Shantell Sans Variable, Shantell Sans, cursive"
    fontSize: "2.375rem"
    fontWeight: 800
    lineHeight: 0.95
    fontVariation: "\"INFM\" 100, \"BNCE\" 0"
  title:
    fontFamily: "Shantell Sans Variable, Shantell Sans, cursive"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1
    fontVariation: "\"INFM\" 100, \"BNCE\" 0"
  lead:
    fontFamily: "Andika, Segoe UI, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Andika, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  key:
    fontFamily: "Andika, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1
  label:
    fontFamily: "Patrick Hand, Comic Neue, cursive"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.1
rounded:
  hand: "14px 11px 13px 10px / 11px 13px 10px 14px"
  hand-sm: "8px 6px 8px 7px / 7px 8px 6px 8px"
  pill: "50%"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  crate: "44px"
components:
  button-plain:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.hand}"
    padding: "8px 24px"
    height: "48px"
  button-go:
    backgroundColor: "{colors.bus}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.hand}"
    padding: "8px 32px"
    height: "64px"
  button-go-active:
    backgroundColor: "{colors.bus-deep}"
  button-danger-hover:
    backgroundColor: "{colors.brick}"
    textColor: "{colors.paper}"
  field-input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.lead}"
    rounded: "{rounded.hand-sm}"
    padding: "8px 16px"
    height: "52px"
  sign:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hand-sm}"
    padding: "8px 16px"
  sign-bus:
    backgroundColor: "{colors.bus}"
  sign-brick:
    backgroundColor: "{colors.brick}"
    textColor: "{colors.paper}"
  keycap:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.key}"
    rounded: "{rounded.hand-sm}"
    size: "{spacing.crate}"
  keycap-next:
    backgroundColor: "{colors.bus}"
  keycap-down:
    backgroundColor: "{colors.sand}"
  skill-card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.hand-sm}"
    padding: "8px 12px"
  skill-card-ready:
    backgroundColor: "{colors.bus}"
---

# Design System: KeyWar

## Overview

**Creative North Star: "The Busytown Cross-Section"**

KeyWar is a picture-book town seen in cutaway. Every player is a building with its facade removed; keys arrive as crates riding down the floors and are stamped onto a keyboard-shaped workshop floor at street level, while hits knock bricks out of rival walls. The system is flat gouache on paper: solid fills, one warm brown outline on every shape, small handwritten labels with hairline pointers naming things, and chunky hand-printed display caps. It refuses the dark neon note-highway outright; there is no glow, no gradient lighting, no dark mode.

The shipped ground is a washed sky (`sky-wash`) spread held inside a paper frame: the page body is grained paper, and each screen (home, queue, match, results) is a hand-cornered panel inset 14px (10px in the match) from the viewport, outlined in ink, with sky above and a grass band (plus a road on home) below. Scenery is geometric architecture, clouds and signposts. Illustrated floor interiors, worker and vehicle art for skills, and painted-brick texture are not built; floors are empty paper-shade bays separated by sand beams, and brick is a flat team-coloured border. Treat these as open, not as rules.

Density is playful on home and strict in the match: the match HUD follows legibility-first rules (key legends in Andika, large stamped judgements, colour always paired with shape or text).

**Key Characteristics:**
- Flat gouache fills from a nine-hue paint box; no gradients except functional stripes (road dashes, hatching, plank lines).
- One ink outline (2.5px `#4a2e1c`) on every filled shape, in DOM and on canvas alike.
- Hand-cut, uneven corner radii; nothing is perfectly round-cornered.
- Handwritten Patrick Hand labels with 1.25px hairline pointers and a dot terminus name parts of the scene.
- Depth is painted: a darker bottom band inside shapes plus a soft ground shadow.
- Canvas reads its palette from the CSS tokens at runtime, so lane and DOM share one paint box.

## Colors

A primary-paint picture-book palette: saturated but slightly chalky gouache chips on warm paper, all held by one brown ink.

### Primary
- **School-Bus Yellow** (bus): the action colour. The "go" button, the next key to press (keycap and crate), a selected tool or language option, a ready skill, the stamped crate on hit, the selected mode label. If something says "press this now", it is yellow.
- **Pressed Bus** (bus-deep): the active state of the go button only.

### Secondary
- **Brick Red** (brick): team 0 walls and gable roof, the HP bricks, the wordmark fill, the "¡PUM!" rubber stamp ink, Ctrl-tagged crates, miss/wrong judgements, the targeted-rival dashed outline, the countdown numerals, danger-button hover.
- **Deep Brick** (brick-deep): small text that must read red on paper: error messages and the "sabotage" kind line on tools.

### Tertiary
- **Grass Green** (grass): the ground band on every screen, team 2 walls and dome roof, Shift-tagged crates (drawn in grass-deep on canvas), the x3 streak badge.
- **Sky** (sky): building windows, hold crates and their tail, the "great" judgement fill, the x2 streak badge, the field focus halo.
- **Deep Sky** (sky-deep): team 1 walls and flat roof, the focus outline colour, the ink inside the water-tower meter.
- **Sand** (sand) and **Sand Deep** (sand-deep): the workshop keyboard floor (sand with plank lines), pressed keys, floor beams between storeys, the hit beam, signpost legs. Sand also turns the match sky to dusk in sudden death.

### Neutral
- **Paper** (paper): the stock everything is painted on; surfaces of buttons, signs, keycaps, cards, clouds. Carries a procedural grain on page and sign surfaces.
- **Paper Shade** (paper-shade): the interior wall of a cutaway building (the lane background), scrollbar track.
- **Sky Wash** (sky-wash): the sky of every screen spread; paler than the sky paint chip so painted shapes sit on it.
- **Ink** (ink): the single outline colour and the text colour. Also used at 14-25% alpha for painted depth bands, hatching and plank lines.
- **Ink Soft** (ink-soft): placeholders, empty-seat text, tool kind lines, word ropes between crates.
- **Cement** (cement) and **Road** (road): the cement-mixer sabotage blob in the lane, and the home street.

### Named Rules
**The One Ink Rule.** Every outline, stroke, pointer and text run is ink (#4a2e1c). No black, no grey borders, no second outline colour. The only exceptions are the brick-red rubber stamp and the brick dashed target ring, which are printed marks, not outlines.

**The Yellow Means Now Rule.** Bus yellow marks the single thing to act on: the next key, the primary action, the selected or ready option. Do not use it as decoration.

**The Never-Colour-Alone Rule.** Teams carry a roof shape (gable, flat, dome) as well as a wall colour; judgements carry a word; unavailable states carry diagonal hatching; modified crates carry a CTRL or SHIFT label. Colour is never the only carrier of meaning.

## Typography

**Display Font:** Shantell Sans Variable (with Shantell Sans, cursive), axes `"INFM" 100, "BNCE" 0`
**Body / Key Font:** Andika (with Segoe UI, sans-serif)
**Label Font:** Patrick Hand (with Comic Neue, cursive)

**Character:** Shantell Sans with full informality, set in caps at weight 700-900, stands in for sign-painter marker lettering; it runs wider than reference hand-lettering, which is a known gap rather than an intent. Andika carries body copy and every key legend because its letterforms are unambiguous (l / I / 1, a / ɑ). Patrick Hand is the small handwritten voice of labels and annotations.

### Hierarchy
- **Display** (800, clamp(3.5rem, 8vw, 6rem), 0.95): results headline. The wordmark runs clamp(4rem, 10vw, 6rem) in brick with a 3px ink text stroke, rotated -2deg.
- **Headline** (800, 2.375rem, 0.95, caps): home tagline, queue and section titles.
- **Title** (700, 1.625rem, 1, caps): go button, mode names, match clock, sign text.
- **Lead** (400, 1.3125rem, 1.5): pitch copy (max ~34ch), field input, field labels (in Patrick Hand), plain-button text in display caps.
- **Body** (400, 1.0625rem, 1.5): running text, rival names in display at this size.
- **Key** (700, 1.375rem, 1): keycap legends; canvas crates scale legends to 52% of crate size, workshop keys to 38% of a key unit, clamped 0.75-1.25rem.
- **Label** (400, 1rem, 1.1, Patrick Hand): callouts, sign sub-lines, stats, skill meta, key hints.

### Named Rules
**The Stroked Shout Rule.** Large moment words (wordmark, results headline, countdown numerals, judgements, streak number, rival "cast" pop) are display caps in a paint colour with a 2.5-3px ink text stroke and `paint-order: stroke fill`. Running text is never stroked.

**The Legible Key Rule.** Anything the player must read to type (key legends, crate letters) is Andika 700, never the display or label face.

**The Three Voices Rule.** Display caps announce, Andika informs, Patrick Hand annotates. Don't swap roles.

## Layout

Each screen is a single framed spread: a hand-cornered ink-outlined panel inset from the viewport (14px on home, queue and results; 10px in the match) on a grained paper body. Inside, sky-wash fills the upper area and a grass band sits at the bottom (132px with a road on home, 54px in the match, 80px on flow screens). Content stands on that ground line.

Spacing runs on a 4px base (4, 8, 12, 16, 24, 32, 48, 64). The crate (44px, one key unit) is the layout module for keycaps; in the match the keyboard floor derives its unit from the building width (`100cqw / 14.5`) via a container query, so keys and lane always align.

- **Home:** two columns (intro + form card at left, max 620px; a street of mode buildings at right), collapsing to one column under 960px; the nickname/language row stacks under 520px. Clouds hide under 960px.
- **Match:** three-column arena (rivals | your building | rivals) with your building on `minmax(560px, 3.2fr)` and capped at 880px; 3v3 narrows the centre to 2.3fr and turns each side into a street of three short buildings. Under 1180px the arena stacks with rivals on top. Lane height is whatever the viewport leaves, clamped 220-600px.
- **Flow (queue, results):** centred column, cards up to 420px; results line buildings up as a street.

## Elevation & Depth

Depth is painted, not lit. Filled shapes carry an inner darker band along their bottom edge, as a gouache painter would shade a block, and objects that stand on the ground cast a soft warm shadow beneath them. Pressing removes the ground shadow (the object sits down). There are no glows, no layered material elevations and no hard offset shadows.

### Shadow Vocabulary
- **Paint depth** (`box-shadow: inset 0 -5px 0 rgb(74 46 28 / 0.16)`): on buttons, signs, keycaps, skill cards, the streak badge, selected tools. Canvas crates repeat it as a 6px band.
- **Ground shadow** (`box-shadow: 0 6px 14px -6px rgb(74 46 28 / 0.35)`): on buttons at rest, the home form card, building bodies.
- **Cut-wall inset** (`inset 2.5px 0 0 ink, inset -2.5px 0 0 ink`): the inner ink line inside a building's thick team-coloured side walls.

### Named Rules
**The Painted Depth Rule.** Depth comes from the bottom band and the ground shadow, both in ink-brown alpha. Pressed = band only, shifted down 1-2px.

## Shapes

Corners are hand-cut and deliberately uneven: `14px 11px 13px 10px / 11px 13px 10px 14px` for panels, cards and buttons, and the small `8px 6px 8px 7px / 7px 8px 6px 8px` for fields, signs, keycaps, tools and skills. Every filled shape has the 2.5px ink line; secondary pieces (tool cards, windows, workshop keys) use 2px, and tiny tags and bricks 1.5px. Hairline pointers are 1.25px with a 5px dot at the far end.

Recurring silhouettes: the cutaway building (team roof SVG, thick team-coloured side walls, paper-shade floors split by 5px sand-deep beams over an ink line); the signpost board on two sand-deep posts; clouds built from rounded paper blobs outlined with a four-way 2px ink drop-shadow; round streak badge; crates as 8px-radius rounded squares, 22% taller when tagged with a modifier.

Hover gestures are physical and slightly off-axis: buttons lift 2px and tilt -0.6deg, tools tilt -1deg, mode buildings rise 6px.

## Components

### Buttons
Painted wooden-sign buttons: chunky, outlined, sitting on the ground.
- **Shape:** hand-cut corners (rounded.hand), 2.5px ink line, minimum 48px tall.
- **Plain:** paper fill, display caps at lead size, paint depth plus ground shadow.
- **Go:** bus yellow, title size, 64px tall, 32px inline padding; active turns bus-deep.
- **Danger:** paper at rest; turns brick with paper text on hover and active.
- **Ghost:** no border or shadow, sentence case at body size, 2px underline offset 4px (e.g. "Leave (Esc)").
- **Hover / Active:** lift -2px with -0.6deg tilt over 120ms ease-out; active drops 1px, scales 0.98 and loses the ground shadow.
- **Disabled:** diagonal ink hatching at 18% and ink-soft text, never only greyed.

### Fields
- **Style:** 52px tall, 2.5px ink line, small hand corners, near-white paper fill, Andika 700 at lead size; Patrick Hand label above.
- **Focus:** border turns sky-deep with a 3px sky halo (no dashed outline on the input itself).

### Segmented option (language)
Two outlined paper tiles joined edge to edge with the outer corners hand-cut; the selected tile fills bus yellow; focus draws the dashed sky-deep outline around the tile.

### Tool / skill cards
- **Tool (home picker):** 2px ink line, small corners, paper; name in Andika 700, kind and cost in Patrick Hand; sabotage kind in brick-deep; selected fills bus with paint depth; the bound key ("Space", "Enter") sits as a small outlined tag on the top edge.
- **Skill (match street):** 2.5px line, key tag, display-caps name, label meta. Ready = bus yellow with a 500ms squash nudge; no ink or cooldown = hatched.

### Callout (signature)
The handwritten label with a hairline pointer: Patrick Hand at label size, a 1.25px ink line of adjustable length tilted 8deg (or vertical for up/down) ending in a 5px ink dot. Used to name the ink tower, the hit line, mode buildings and crate words on canvas. This is the system's annotation device; every named part of the scene should be pointed at, not captioned in a box.

### Sign (signature)
A painted board: small corners, grained fill in paper, bus, grass, brick or sky, display caps with an optional Patrick Hand sub-line, paint depth. Optional two sand-deep posts. Used for nameplates on roofs, the clock and phase in the match bar, the region signpost, sabotage notices (which swing in with a squash) and the hanging "target" sign over a rival.

### Building (signature)
The cutaway house: team roof (gable / flat / dome) above a body with 14px team-coloured side walls, inner ink lines, paper-shade floors split by sand-deep beams. HP renders as a brick wall meter (5 or 10 bricks per row, offset courses, lost bricks dashed and empty, a struck brick tumbles 700ms to the street). A knocked-out building goes 85% greyscale at 70% opacity. A targeted rival gets a 3px dashed brick ring.

### Keyboard floor and keycaps
The workshop floor is sand with plank lines at each key row and a sand-deep top beam; keys are paper with 2px ink line, uneven 7/6/7/5px corners and an inner depth band. Next key fills bus yellow; held key goes sand(-deep) and drops 2px.

### Lane canvas (crates, stamp, sabotage)
- **Crates:** bus by default, sky for holds (with a sky rope tail), grass-deep labelled SHIFT, brick labelled CTRL; 2.5px ink stroke, 8px corners, painted depth band; missed crates drop to 35% alpha. Crates of one word are joined by a dashed ink-soft rope and the word is written once in Patrick Hand with a hairline pointer.
- **Hit beam:** a 12px sand-deep beam outlined in ink across the floor's foot.
- **Stamp:** on a hit the crate squashes wide and flat (140ms) then fades by 420ms, while a brick-ink rubber stamp, rotated about -8deg, prints the stamp word (e.g. "¡PUM!") above it, larger on perfect.
- **Sabotage:** cement mixer is a wobbling cement blob with ink hatching and an ink outline over the middle of the lane; blackout is a 95% ink band over the lower lane; quake shakes the lane (disabled under reduced motion); mirror flips legends.

### Water tower (ink meter)
An outlined paper tank on crossed legs that fills from the bottom with striped sky-deep ink; labelled by a callout.

### Streak badge
72px round outlined badge with a stroked display number; paper at x1, sky at x2, grass at x3, brick at x4.

## Do's and Don'ts

### Do:
- **Do** outline every filled shape in ink (#4a2e1c) at 2.5px (2px for small parts, 1.25px for pointers).
- **Do** use the hand-cut radii (rounded.hand, rounded.hand-sm) instead of uniform corner values.
- **Do** name scene parts with a Patrick Hand callout and hairline pointer.
- **Do** pair every team colour with its roof shape (brick/gable, sky-deep/flat, grass/dome).
- **Do** show unavailable states with diagonal ink hatching.
- **Do** read canvas colours and fonts from the CSS tokens (as `readPaint()` does) rather than hard-coding them.
- **Do** keep motion on `--ease-out` and `--ease-squash` with the 120/220/420ms durations, which collapse to 0 under reduced motion.

### Don't:
- **Don't** use dark backgrounds, neon, glows or gradient lighting; this is the note-highway the world refuses.
- **Don't** introduce black or grey outlines or a second outline colour.
- **Don't** set key legends in the display or label faces.
- **Don't** stroke running text; text strokes are for moment words only.
- **Don't** use bus yellow for anything that is not the current action or selection.
- **Don't** use hard offset (neobrutalist) shadows; depth is the painted bottom band and soft ground shadow.
