# Scene plans for the video banners (`scene.md`)

Every story's video banner (and, for `social.priority` 4-5, its 15 s reel) is made on the Oracle
server with Meta Vibes from still frames that an image model paints. Makima writes the scene
plan with the story, so the server only paints and animates it.

**How:** put `scene.md` in the story folder, in the SAME commit as `story.json` and `spec.json`
(the server starts within three minutes of the commit). English, at most 25 lines, in this shape:

    Concept: <one id from CONCEPTS.md: people, pet, miniature, object, metaphor, everyday,
              period, documentary, sport, spectacle, noir, toys>
    Stake: <one line: who gains power or money, who pays, what changes for the viewer>
    Scene: <the real situation as a physical event, already happening at frame 0>
    Cast: <who is in it, what they wear, what each one does>
    Attention: <one or two ingredients and the job each does in the story>
    Logo: <which brand logo goes on which large, flat, blank surface facing the camera>
    Banner: <the 16:9 moment that loops; faces and action centre/right, calm lower-left third>
    Reel: <only for priority 4-5: four moments F1-F4 of one continuous shot,
           A = the moment (F1->F2), B = the turn (F2->F3), C = the result (F3->F4)>

## Concept first (from 2026-11-05)
Pick the concept before anything else: read `CONCEPTS.md` (twelve concepts, rotation rules) and
the last videos' concepts in the `health` branch's METRICS.md. Choose the concept that tells THIS
story best and is allowed by the rotation (not used in the last 4 videos; `people` at most once
in 6; `spectacle` only for priority 5). Then write the scene inside that concept: a `pet` concept
is a cat scene, a miniature concept is a tabletop model, and so on. Cast, ingredients and logo
surface follow from the concept; many concepts have no people at all. If the pick breaks a
rotation rule, the server replaces it and plans the scene itself.

## Rules
- **Physical world, never a person at a screen.** Nobody stares at a monitor or phone (a TV or
  tablet as an object in a room, as in the `pet` example, is fine). Turn the news into
  an event people understand at once: access control is a doorman at a velvet rope, a price rise
  is a receipt that never ends, a lawsuit is a courtroom, a cut-off is a giant switch, a launch is
  a stage, an acquisition is a handover. Software and AI agents appear as physical stand-ins
  (sleek unbranded robots, couriers with glowing visors, glowing cubes).
- **Photorealistic, cinematic.** Today's real world, unless the concept is `period` (another
  era) or `miniature`/`toys` (real models and toys, photographed for real). No fantasy props.
- **Real people:** when the story is about a company with a famous leader (OpenAI: Sam Altman,
  Anthropic: Dario Amodei, Meta: Mark Zuckerberg, Nvidia: Jensen Huang, Google: Sundar Pichai,
  Microsoft: Satya Nadella, Apple: Tim Cook, Tesla/xAI: Elon Musk), the leader may appear, and then
  everyone in the frame is rendered as a AAA game-cinematic CG character. Never put a real person
  in a scene that implies a crime, an injury, an arrest or a quote they did not give.
- **Invented people** (when the concept has people) are attractive, stylish adults with a role
  in the action; vary the cast (one person, a crowd, older people, many professions), never the
  default "one woman and one man working together". Women: fit,
  confident, modern outfits that may show some skin within normal street and office wear (fitted
  top with a neckline, mini skirt, leggings, a blazer over a crop top); the camera stays on the
  action and faces, never on bodies.
- **Attention ingredients** (vary them; ingredients of recent stories are in the `health`
  branch, METRICS.md): cats (the only pets; never dogs; an animal never stands for a company or person), attractive people, giant scale, money made
  physical, satisfying physics (glass cracking, a stack toppling, a perfect fit clicking), speed
  and machines, weather (lightning, rain, sparks), one impossible detail, a stage and crowd, a face
  looking straight at the camera with a clear reaction. Never children, real disasters or
  victims, animals in distress, gore.
- **No text or logos are painted.** Name only a blank surface for each logo; the real logo is
  added in code. Screens and papers stay blank.
- **Reels:** a medium shot with the main subject large (faces, the animal or the hero object in
  the upper half); the captions cover the lower part of the frame, so the logo surface sits in
  the upper half too (a sign or panel behind the subject), never on a foreground desk or floor.

The server may correct a plan that breaks these rules. Without `scene.md` the server plans the
scene itself (slower and it uses more of its quota).
