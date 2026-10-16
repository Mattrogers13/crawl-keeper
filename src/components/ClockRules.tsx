// The Crawling Clock rules, in our own words (the sheet in sources/ isn't
// ours to ship). Shown in Settings and on the how-to page.
const ClockRules = () => (
  <div className="flex flex-col gap-2 text-sm">
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      <li>
        The clock is a d20 on the table, in view of everyone. It starts at 20 when the party enters a dangerous place.
      </li>
      <li>
        At the end of each crawl round, on the GM's turn, the GM rolls the crawling die (a d6) and takes the result off
        the clock. When the die shows its highest face, roll it again and add.
      </li>
      <li>
        At 0 or below: a random encounter, resolved with the core rules. Whatever the roll went past 0 carries into the
        next clock, which starts at 20 minus that.
      </li>
      <li>
        At 5 or below (but not 0): an omen. The GM may roll the encounter now and foreshadow it; it still arrives when
        the clock hits 0.
      </li>
      <li>
        A fight doesn't reset the clock. It only starts over at 20 when the party enters a new dangerous place (Reset
        clock), or after its own encounter.
      </li>
    </ul>
    <p className="font-medium">Optional rules</p>
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      <li>Darkness: if the party's light goes out, the crawling die steps up to a d8.</li>
      <li>Hidden clock: if players start playing around the clock, hide it from them (a setting).</li>
    </ul>
    <p className="text-xs text-obr-text-secondary">
      An alternative to Shadowdark's 1-in-6 check, from the Crawling Clock rules sheet, based on Goblin Punch's “The
      Underclock: Fixing the Random Encounter”.
    </p>
  </div>
);

export default ClockRules;
