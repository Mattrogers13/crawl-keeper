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
            Monsters are listed under the <b>GM / Monsters</b> row and act on its roll. Put the highest DEX modifier among
            them in its <b>DEX</b> box and click the d20 to roll d20 + that (core pp. 83, 88).
          </li>
          <li>Type each player's roll in their row (click the number to edit it), then press Sort (☰) for highest first.</li>
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
            when Deadly or in total darkness (p. 84). An encounter on a 1.
          </li>
          <li>
            <b>Crawling Clock</b>: a d20 clock that the crawling die wears down each crawl round (rules below).
          </li>
        </Steps>
        <p>
          The roll button is always there for an extra check (a loud noise, p. 112), which doesn't change the schedule.
          It's outlined when a roll is due and filled when it's due on the GM's turn. Undo takes back the last roll.
          Settings can roll it for you when ▶ reaches the GM's turn.
        </p>
      </Section>

      <Section title="Combat">
        <Steps>
          <li>
            Press <b>Combat</b>. Everyone gets a "Roll for combat initiative" alert, and the rolls clear for a fresh roll
            (a setting; core p. 88).
          </li>
          <li>Enter the new rolls, roll for the GM / Monsters row, Sort, then ▶.</li>
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
          hides them. Tokens hidden on the map stay out of their list. Nothing in the panel is editable for players, and
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
