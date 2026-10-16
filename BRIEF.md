# Extension brief

Fill this in before building. Tick boxes with `[x]`, write short answers after the arrows, skip anything that doesn't apply. "Not sure" is a fine answer; Claude will ask.

When you're done, change the next line to `Status: DONE` and tell Claude to read the brief.

Status: DRAFT

---

## 1. The pitch

- Name → 
- One sentence: what does it do? → 
- What problem at the table does it solve? → 
- Game system (or "any") → 
- Who uses it?
  - [ ] GM only
  - [ ] Players only
  - [ ] Both, same view
  - [ ] Both, different views

## 2. Where it shows up in Owlbear (tick all that apply)

- [ ] A toolbar button that opens a panel
- [ ] A number or badge on that toolbar button (e.g. "3 active") → what would it show? 
- [ ] Right-click on tokens or other things on the map → which things? 
- [ ] A new tool on the left toolbar, with its own modes (like drawing or measuring) → what does clicking/dragging on the map do? 
- [ ] A large window over the map
- [ ] Things drawn on the map itself (see section 3)
- [ ] Nothing visible: it just runs in the background
- Rough panel size, if it has one → 

## 3. What it does to the map (tick all that apply)

- [ ] Reads tokens (names, positions, who owns them)
- [ ] Changes tokens → what? (name, size, image, position, visibility, other) 
- [ ] Uses whatever is currently selected
- [ ] Adds things to the map:
  - [ ] Images
  - [ ] Shapes, lines or drawings
  - [ ] Text or labels
  - [ ] Badges or markers stuck to tokens (they move with the token)
- [ ] Fog, lights or walls → 
- [ ] Measures distance or uses the grid
- [ ] Moves or zooms the camera
- [ ] Should work with undo
- [ ] Things only I see on my screen, not shared with anyone

## 4. Who sees and changes what

- [ ] GM-only information
- [ ] Players can see it
- [ ] Players can change it → what exactly? 
- [ ] Each player has their own private-ish data
- [ ] Some of it must stay hidden from players → what? 
  - ⚠️ Anything shared through Owlbear is readable by every player's browser. Real secrets need a server. Describe it anyway; Claude will suggest options.
- [ ] Players can only affect their own tokens

## 5. Where the data lives (tick all that apply)

- [ ] Belongs to the room (everyone in the room shares it)
- [ ] Belongs to the current map/scene (switching maps switches the data)
- [ ] Belongs to individual tokens (travels with the token)
- [ ] Belongs to each player
- [ ] Personal preferences on my own computer only (e.g. a setting or filter)
- [ ] Nothing needs saving
- Roughly how much data? (e.g. "a list of about 20 things with a name and a number") → 
  - Note: everything shared in a room has to fit in about 16 kB across all extensions.

## 6. Timing

- [ ] Everyone should see changes instantly
- [ ] One-off alerts or pings (e.g. "the torch went out!")
- [ ] Timers or countdowns
- [ ] Must keep working when the panel is closed
- [ ] Should react when a map loads or tokens change

## 7. Outside connections

- [ ] Works with another Owlbear extension → which? 
- [ ] Import or export (files, copy/paste) → what format? 
- [ ] Lets people pick images from their Owlbear uploads
- [ ] Calls an outside website or API → which? 
  - ⚠️ API keys can't be kept secret in an extension with no server.

## 8. Look and feel

- [ ] Match Owlbear's own look (default)
- [ ] Custom look → describe or point to references: 
- Icon idea → 
- Reference art, screenshots or similar extensions (drop files in `sources/`) → 

## 9. Scope

- Must-haves for the first version (v0.1) → 
  1. 
  2. 
  3. 
- Nice later → 
- Deliberately NOT doing → 
- Rules or reference material (put PDFs/notes in `sources/`, never committed) → 
- Anything else Claude should know → 
