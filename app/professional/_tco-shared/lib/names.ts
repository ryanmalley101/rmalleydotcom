// Short display names for the results page. A composed on-prem name like
// "Milestone XProtect · Axis Communications cameras" is repeated in the
// verdict, the chart legend, every driver and tipping point, and the editor
// headers; at full length it wraps or gets cut off almost everywhere. The
// part before the first " · " names the system well enough there, and the
// full name stays in the editor header and in every export.
//
// Falls back to the full names when shortening would make the two sides
// read the same (e.g. one VMS with two different camera vendors).
export function shortNames(nameA: string, nameB: string): [string, string] {
  const short = (n: string) => n.split(" · ")[0].trim() || n;
  const a = short(nameA), b = short(nameB);
  return a === b ? [nameA, nameB] : [a, b];
}
