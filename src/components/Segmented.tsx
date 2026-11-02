// A segmented pill of choices (radios underneath, for the keyboard and
// screen readers).
const Segmented = <T extends string | number>(props: {
  label: string;
  name: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) => (
  <div role="radiogroup" aria-label={props.label} className="flex rounded-full bg-obr-paper p-[3px]">
    {props.options.map(([value, label]) => (
      <label
        key={value}
        className={`flex h-8 flex-1 cursor-pointer items-center justify-center rounded-full font-medium has-focus-visible:ring-2 has-focus-visible:ring-obr-primary ${
          props.value === value ? "bg-obr-primary text-obr-primary-contrast" : "hover:bg-obr-text/10"
        }`}
      >
        <input type="radio" name={props.name} className="sr-only" checked={props.value === value} onChange={() => props.onChange(value)} />
        {label}
      </label>
    ))}
  </div>
);

export default Segmented;
