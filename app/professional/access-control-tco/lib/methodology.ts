// Plain-language summary of how lib/model.ts computes a comparison. Keep this
// in step with the model: every change to the cost math should update the
// matching line here (and the README's cost model section).
export const METHODOLOGY_NOTES: string[] = [
  "Year 0 is the buildout. A solution marked incumbent pays nothing then, since it's already installed, unless its server refresh or license renewal is due now (0 years away). Every other solution pays its first license term or perpetual license, any servers, and installation.",
  "On doors that aren't wired yet, every newly deployed solution buys door hardware, readers, and controllers, pays a full install per door, and issues every cardholder a credential. On wired doors, the door hardware stays whoever wins; each solution keeps or replaces the readers and controllers by its own setting, and pays migration labor per door.",
  "Controllers are sized by doors per controller, with at least one per site.",
  "Readers and controllers fail at a steady rate set by each solution's half-life, and replacements can fail again. Each batch has its own warranty, counted from when it was installed; hardware already on site starts at the age entered for it. A failure under warranty costs only replacement labor.",
  "Cloud license terms are paid per door as a lump sum at purchase and at each renewal, plus any yearly site fee. Server-based licenses are bought once, with a yearly support renewal on them; servers are bought at year 0 and on each refresh, with their own upkeep hours.",
  "Cards are bought for new hires and lost cards every year; mobile credentials carry their yearly fee, if any. Cardholder admin counts a removal and an add for each leaver, plus access changes and lost credentials, at each solution's minutes per change.",
  "Admin hours per door, minutes per cardholder change, minutes per door alarm, and truck rolls start the same for both deployment models. Server upkeep is the only staff-time line that differs by default.",
  "Prices grow at three separate escalation rates: one for labor and services, one for hardware, and one for licenses and subscriptions. Purchases with a fixed service life that runs past the horizon are credited for their unused share in the final year, unless that option is turned off.",
  "Admin, cardholder admin, and alarm handling are estimates of staff time, shown separately from cash costs.",
  "Business impact is optional and industry-specific. Each solution's change to a cost the business has today (theft, rekeying, staffed doors) is a percentage of that cost, and new costs it brings are entered directly. Changes start in year 1, grow with labor escalation, and are shown separately from cash costs. The incumbent has no change, since today's figures already reflect it.",
  "Picking a researched vendor fills in its published prices and hardware compatibility, each marked with a source dot; everything else is an unsourced placeholder, not a quote. Many vendors only quote prices privately, so their license price stays generic. This tool is not affiliated with or endorsed by any vendor named here.",
];
