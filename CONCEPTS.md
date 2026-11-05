# Visual concepts for the video banners and reels

Since 2026-11-05 (Sedat's decision) every story's video uses ONE of the twelve concepts below.
They are ways of telling the story in pictures; all of them stay photorealistic and cinematic (real
lenses, light and materials). Before this, every video was "a man and a woman doing a task
together"; that is now only concept 1, and it may appear at most once in six videos.

Makima picks the concept in `scene.md` (first line `Concept: <id>`, see `SCENES.md`). The Oracle
server checks the rotation rules below; if the pick breaks one, or there is no `scene.md`, the
server picks the fitting concept used longest ago and plans the scene itself. The concept and text
style of each video are logged, and the `health` branch's METRICS.md shows them next to the views.

## Rotation rules
- A concept used in any of the last 4 videos is not used again.
- `people` appears at most once in any 6 videos.
- `spectacle` only for `social.priority` 5.
- Never children, real disasters or victims, animals in distress, gore. Famous people only as AAA
  game-cinematic CG characters (and then everyone in the frame is CG). Logos are never painted:
  name a large, flat, blank surface for each one; the real logo is added in code.

## The twelve concepts

| id | Concept | Fits best |
|---|---|---|
| `people` | People at work | funding, hiring, launches with a famous leader |
| `pet` | A pet takes the lead | consumer apps, home, entertainment, assistants |
| `miniature` | Miniature world | infrastructure, cloud regions, factories, logistics |
| `object` | The object is the hero | chips, devices, hardware, a single product |
| `metaphor` | One physical metaphor | security features, policy, abstract model features |
| `everyday` | An everyday moment | features people use: learning, writing, search, shopping |
| `period` | A period piece | developer tools, "new apprentice/assistant" stories, comebacks |
| `documentary` | Wildlife documentary | agents, safety, monitoring, swarms, research |
| `sport` | Sport and race | benchmarks, rivalries, partnerships, handovers |
| `spectacle` | Giant scale | the biggest launches only (priority 5) |
| `noir` | Film noir thriller | security, leaks, lawsuits, regulation, identity |
| `toys` | A world of real toys | playful app features, creative tools, small updates |

1. **`people` - People at work.** Real people doing the thing that happened. The cast is free:
   one person, a crowd, an older craftsman, a team of five; not the default "one woman and one
   man at a bench". Example: a funding story as a packed trading floor erupting.
2. **`pet` - A pet takes the lead.** A cat or dog acts the story out in a real home. Example
   (Netflix AI Discovery): a cute cat on the sofa, paw on the remote, the TV shows the Netflix
   logo; every press changes the glow on the screen. A TV or tablet as an object in the room is
   fine here; a person staring at a monitor is not.
3. **`miniature` - Miniature world.** A real tabletop scale model shot with a macro lens and
   shallow depth of field (tilt-shift look): tiny figures, trucks, buildings. Logo on a building
   sign or billboard. Example (Kimi in India): a model of an Indian city, a tiny data centre with
   an AWS sign on its roof, tiny trucks carrying server racks in.
4. **`object` - The object is the hero.** No people: the product itself, macro, dramatic light,
   smoke, sparks, liquid, a turntable. Logo on the product's lid, a plinth plate or its box.
   Example (STM32): the chip on a board, a fly-sized robot arm soldering on it in a shower of
   sparks.
5. **`metaphor` - One physical metaphor.** The news becomes a single strong object or action.
   Example (Claude watermarks): a wax seal pressed onto a stack of letters, the seal plate
   carrying the Anthropic mark.
6. **`everyday` - An everyday moment.** Not the company, the user: an adult using the feature
   in ordinary life (a student at a kitchen table late at night, a commuter, a small shop
   owner). The feature appears as a physical stand-in (paper cards, a glowing guide, a robot
   helper), not as a screen. Logo on a notebook cover, a shop sign, a tote bag panel.
7. **`period` - A period piece.** The story replayed in another era: a 1920s print shop, a
   1950s watchmaker, a 1960s mission control, a Renaissance workshop. Example (Copilot in
   Xcode): a master watchmaker takes a new apprentice at his own bench; the GitHub logo on the
   apprentice's toolbox, the Apple logo on the workshop sign.
8. **`documentary` - Wildlife documentary.** Real animals in the wild as the metaphor, shot
   like a nature film (long lens, golden light). Example (OpenAI safety probes): a meerkat
   sentinel on a rock watches over the colony and stops it when danger comes. Logo on a ranger
   station sign, a research crate or a trail marker.
9. **`sport` - Sport and race.** A race, relay, pit stop, ring or match. Example (MongoDB in
   Microsoft 365 Copilot): the baton passes between two relay runners; the logos on their
   chest panels.
10. **`spectacle` - Giant scale.** One colossal object in a real city or landscape. Example
    (CUDA on Vera Rubin): a skyscraper-sized GPU rising out of the harbour at dawn. Priority 5
    only.
11. **`noir` - Film noir thriller.** Night, rain, hard light, a detective, a vault, a
    courtroom. Example (Google Auth Manager): a rain-soaked vault room, a wall of hanging keys,
    one master key lifted from its hook. Logo on the vault door plate.
12. **`toys` - A world of real toys.** Real toys photographed for real: wind-up tin robots,
    wooden figures, model trains, plush. No toy brands. Example (OpenAI GIFs in Images 2.6): a
    wind-up tin robot flipping a flipbook whose pages come alive; the logo on the toy box lid.

## Text styles

The headline and captions also rotate through eight text styles; the server picks one that fits
the concept and was not used in the last two videos (Makima does not choose it):
`band` (highlight band), `type` (typewriter), `slam` (words slam in), `wipe` (bar wipe),
`giant` (one giant word settles into place), `blur` (blur to sharp), `glitch` (RGB glitch),
`stamp` (rubber stamp).
