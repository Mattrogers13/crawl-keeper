import type { ReactNode } from "react";

import manifest from "../../public/manifest.json";
import ClockRules from "./ClockRules";

// Shown when the page is opened outside Owlbear (no ?obrref): the extension's
// public homepage and how-to guide (Settings links here). Owlbear's install
// flow needs the manifest URL, so it comes first.
const Homepage = () => {
  const manifestUrl = `${window.location.origin}/manifest.json`;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8 leading-relaxed sm:px-8">
      <header className="flex items-center gap-3">
        <img src="/img/logo.png" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-3xl font-bold">{manifest.name}</h1>
          <p className="text-obr-text-secondary">{manifest.description}</p>
        </div>
      </header>

      <Section title="Install">
        <p>In Owlbear Rodeo: Extensions → Add Custom Extension, then paste this manifest URL:</p>
        <code className="block rounded-lg bg-obr-bg p-3 break-all">{manifestUrl}</code>
        <p>Then turn it on for your room. The GM sees the full panel; players get a read-only view.</p>
      </Section>

      <Section title="Set up a scene (GM)">
        <Steps>
          <li>Open a scene. Each map keeps its own tracker, rounds and clock.</li>
          <li>
            Right-click tokens on the map and pick <b>Add / Remove Initiative</b>. They join as players and allies.
          </li>
          <li>
            Right-click a row in the panel (or hover it and click ⋯) for its menu: <b>Mark as monster</b>, dead or alive,
            turn marker on or off, show on map, remove. Click, Shift-click or Cmd/Ctrl-click rows to act on several at
            once.
          </li>
          <li>
            Exploring on one token? Right-click it → Crawl Keeper → <b>Set as party token</b> (or use a row's menu). A <b>Party | Split</b> switch
            appears under the turn bar. Party: the players gather around the party token (clear of Dynamic Fog's walls),
            attach to it and hide, so they travel with it; the party token takes the turns at the highest player's roll.
            Split (or Combat): they show again where they stand and take their own turns. To regroup elsewhere, drag the
            faded party token there before pressing Party. The light goes with the switch: coming together it moves to the
            party token, splitting you pick who carries it. <b>Rename…</b> in a row's menu renames the token itself.
          </li>
          <li>
            Monsters are listed under the <b>GM / Monsters</b> row and act on its roll. Put the highest DEX modifier among
            them in its <b>DEX</b> box and click the d20 to roll d20 + that (core pp. 83, 88).
          </li>
          <li>
            Type each player's roll in their row (click the number to edit it). The list sorts itself, highest first, as each
            roll goes in; the <b>Init</b> heading sorts it again after a drag.
          </li>
        </Steps>
      </Section>

      <Section title="Running turns">
        <Steps>
          <li>
            <b>▶</b> starts the first round and moves to the next turn; <b>◀</b> goes back. The round count sits beside the
            title.
          </li>
          <li>
            Drag a row by its grip to change the order. Dead rows keep their place but are skipped.
          </li>
          <li>
            A gold ring marks the current token on the map, and Owlbear selects it on your screen (both can be turned off
            in Settings; a gold dot on a portrait shows which tokens get the ring).
          </li>
          <li>
            Hotkeys, after you click anywhere in the panel: <b>N</b> next turn, <b>B</b> back, <b>R</b> roll the encounter
            check when it's due. Owlbear keeps keys typed on the map to itself, so click the panel first.
          </li>
        </Steps>
      </Section>

      <Section title="Crawling">
        <p>
          Shadowdark is always in turn order. While crawling, the GM checks for encounters on the GM's turn. Pick the
          method in Settings:
        </p>
        <Steps>
          <li>
            <b>Standard checks</b> (core p. 112): a d6 every 3 crawl rounds when Unsafe, every 2 when Risky, every round
            when Deadly. In total darkness, a check every crawl round (p. 84). An encounter on a 1.
          </li>
          <li>
            <b>Crawling Clock</b>: a d20 clock that the crawling die wears down each crawl round (rules below); a d8 in
            total darkness. Settings can make it two d20s, run down one at a time.
          </li>
          <li>
            <b>Manual rolls</b> (Settings, "Encounter checks and the Crawling Clock" off): no clock, no auto roll and no
            danger level. The bar keeps the Torchlit / Darkness switch and a small die for the odd check (a d6, a d8 in
            darkness); the eye beside it shows or hides your rolls to players. A due check counts as made when you press ▶.
          </li>
        </Steps>
        <p>
          The roll button is always there for an extra check (a loud noise, p. 112), which doesn't change the schedule.
          It's outlined when a roll is due and filled when it's due on the GM's turn. Undo (under the list, or Cmd/Ctrl+Z) takes back the last roll, or any other change you made.
          Settings can roll it for you when ▶ reaches the GM's turn. With the <b>Dice+</b> extension installed, these rolls
          (and the monsters' initiative and the death timer) roll as 3D dice everyone sees; encounter rolls only you see
          unless you show the rolls to players (Settings → Dice).
        </p>
      </Section>

      <Section title="Lights and darkness">
        <Steps>
          <li>
            Give a token a light: right-click it on the map → <b>Crawl Keeper</b> → Light torch, Light lantern, Cast Light
            or Light campfire, or use a row's menu. One lit light per token. With Dynamic Fog on, the token casts it: near
            (30 ft), a lantern double near (60 ft). Every party token without one keeps 3 ft of dim light.
          </li>
          <li>
            The flame beside the gear opens the <b>Light Tracker</b>: every light's time left (click a time to correct
            it), Put lights out, and how a second light burns (Ride along or Separate timers, p. 84); the <b>i</b> there has the
            rules. ❚❚ in the header pauses every light (a red Paused bar shows until you click it). Torches and lanterns
            last an hour of real time (p. 82).
          </li>
          <li>
            The hourglass beside the title is <b>Time passes</b>: 10m, 30m, 1h, an 8 hour rest (p. 86) or any time
            (1:30, 90). It shows what will happen first: each light's time before and after, and the effects that end.
          </li>
          <li>
            A torch, Light spell or campfire is used up once lit: putting it out spends it, and once it's out it's out (its
            badge goes at the next turn). A lantern put out keeps its oil, rounded down to the quarter hour. To move a light,
            select two tokens, one holding it, and right-click → Crawl Keeper → <b>Hand light to…</b>: the timer goes with
            it. Undo takes back any light change.
          </li>
          <li>
            <b>Follow light</b> (Settings, on): when no tracked light is shining, it's darkness: DIS on the party's
            rows, a check every crawl round, a d8 crawling die (p. 84). With no lights tracked, the crawl card's
            Torchlit / Darkness switch decides.
          </li>
          <li>
            Everyone gets a notice when a light burns out or is put out, and when time passes.
          </li>
          <li>
            <b>Players light their own</b> (Settings, off): players right-click a party token (a player on the list, or a
            token they placed) → Crawl Keeper to light a torch, lantern or Light spell, or put it out. It works while the
            GM is in the room.
          </li>
        </Steps>
      </Section>

      <Section title="Effects">
        <Steps>
          <li>
            Add effects from a row's menu (⋯ or right-click), from a token on the map (right-click → Crawl Keeper → Add
            effect…), or with <b>Add effect</b> under the turn bar for one on no token. With several rows selected, each
            gets each.
          </li>
          <li>
            The sheet takes several at once: click a condition (ADV, DIS, Blinded, Paralyzed, Invisible, Stuck,
            Unconscious) or + Custom for each, and give each its own duration: Rounds, a Roll (1d4, 1d6…), Focus,
            Ongoing, or "while a caster's focus lasts". Rounds count down at the start of the turn you pick. The eye hides
            one from players.
          </li>
          <li>
            <b>Focus</b>: on the caster's turn a reminder asks for the focus check, a spellcasting check as if casting it
            (p. 50). <b>Lost</b> ends it and what lasts with it; <b>Nat 1</b> is also a critical failure (p. 45).
          </li>
          <li>
            Effects sit under their row; two or more fold to one line and open on that row's turn. Click one to set its
            rounds left or remove it. Icons show on the tokens (Settings can turn them off). Everyone gets a notice when an
            effect runs out, and Time passes ends every rounds effect (p. 82).
          </li>
          <li>
            <b>Dying</b> (p. 89): a player at 0 HP → their row's menu → Dying…: roll 1d4 + CON (at least 1) for the
            death timer. On each later turn the notices offer the d20 (a natural 20 rises with 1 HP), Stabilized and
            Healed; when the timer runs out, Mark dead. Monsters at 0 just die.
          </li>
        </Steps>
      </Section>

      <Section title="Session log and Reset all">
        <Steps>
          <li>
            Settings → <b>Session log</b> keeps every notice with its time: lights burning out, time passing, effects
            ending or removed, combat, a focus lost. It's kept in this browser, per room; Download saves it as text.
            Players have their own, from the scroll beside their flame.
          </li>
          <li>
            Notices that need you (total darkness, a focus check) stay under the crawl card; the rest fold to one line, and
            a burned-out light goes once you dismiss it or the turn moves on.
          </li>
          <li>
            Settings → <b>Reset all</b>, at the bottom, starts a new session: the tracker back to the GM row, its effects
            and the lights on its tokens gone, rounds, clock and danger level reset, and the log cleared (download it
            first). Undo brings back all but the log.
          </li>
        </Steps>
      </Section>

      <Section title="Combat">
        <Steps>
          <li>
            Press <b>Combat</b>. Everyone gets a "Roll for combat initiative" alert, and the rolls clear for a fresh roll
            (a setting; core p. 88).
          </li>
          <li>Enter the new rolls and roll for the GM / Monsters row (the list sorts itself), then ▶.</li>
          <li>Each living monster takes its own turn right after the GM / Monsters row, in list order.</li>
          <li>
            Press <b>Crawl</b> when the fight ends. Below the list, <b>Remove monsters</b> clears them out (and the DEX
            box).
          </li>
        </Steps>
      </Section>

      <Section title="What players see">
        <p>
          The turn order, portraits, notes, whose turn it is, Crawl or Combat, and the round and the clock unless the GM
          hides them. Tokens hidden on the map stay out of their list. Their flame opens their own Light Tracker: whether
          the party has light, every light's time and the badges on the rows (unless the GM turns off Show lights to
          players), and their own lights. They see effects and their notices, except those the GM hides, and a green eye on
          the GM's crawl card marks what they can see. Besides lighting their own when the GM allows it, players change nothing, and
          nothing is truly secret: hiding is a display choice.
        </p>
      </Section>

      <Section title="The Crawling Clock">
        <ClockRules />
      </Section>

      <footer className="border-t border-obr-text/10 pt-4 text-xs text-obr-text-secondary">
        v{manifest.version}. Made for Shadowdark RPG by The Arcane Library; not affiliated. The rulebook's text isn't
        included: page numbers point to the core rules.
      </footer>
    </main>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-xl font-semibold">{title}</h2>
    {children}
  </section>
);

const Steps = ({ children }: { children: ReactNode }) => <ul className="flex list-disc flex-col gap-2 pl-5">{children}</ul>;

export default Homepage;
