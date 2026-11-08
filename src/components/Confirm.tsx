import { useState } from "react";

// A text link, like the turn bar's (Reset rounds, Add effect).
export const LINK = "py-1.5 text-xs text-obr-text-secondary underline hover:text-obr-text";

// A link that asks before doing something Undo can't bring back (Clear log,
// Reset all). What Undo covers runs at once instead; the Undo bar names the
// step (Matt, 2026-11-08, reversing the 2026-10-16 confirms). `asking` /
// `setAsking` let a caller open it another way too (e.g. a right-click).
const Confirm = (props: {
  label: string;
  question: string;
  action: string;
  onConfirm: () => void;
  asking?: boolean;
  setAsking?: (asking: boolean) => void;
}) => {
  const [ownAsking, setOwnAsking] = useState(false);
  const asking = props.asking ?? ownAsking;
  const setAsking = props.setAsking ?? setOwnAsking;
  if (!asking)
    return (
      <button type="button" className={LINK} onClick={() => setAsking(true)}>
        {props.label}
      </button>
    );
  return (
    <div role="alertdialog" aria-label={props.question} className="flex flex-wrap items-center gap-1.5 text-xs">
      <span>{props.question}</span>
      <button
        type="button"
        className="h-8 rounded-full bg-red-700 px-3 font-medium text-white"
        onClick={() => {
          props.onConfirm();
          setAsking(false);
        }}
      >
        {props.action}
      </button>
      <button type="button" className="h-8 rounded-full bg-obr-bg px-3 font-medium hover:bg-obr-text/10" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </div>
  );
};

export default Confirm;
