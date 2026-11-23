// Plain-language summary of how lib/model.ts computes a comparison. Keep this
// in step with the model: every change to the cost math should update the
// matching line here (and the README's cost-model section).
export const METHODOLOGY_NOTES: string[] = [
  "Year 0 is the buildout. A solution marked incumbent pays nothing then, since it's already installed, unless its hardware refresh or license renewal is due now (0 years away). Every other solution pays its hardware, first license term or perpetual license, and install or onboarding labor.",
  "Whether a newly deployed solution buys cameras depends on the scenario: on a new site every one does, and with reusable cameras only those set to replace them do.",
  "Hardware refreshes repeat on each solution's refresh cycle. The incumbent's first refresh follows its \"years until next refresh\"; a newly bought system's comes one full cycle after year 0.",
  "Cloud license terms are paid as a lump sum at purchase and at each renewal. For vendors that price by retention, the license scales along a gentle curve above 30 days, (days/30)^0.4, since storage is only part of what it covers; vendors that store video on site keep a fixed license price.",
  "On-prem storage is sized from bitrate, retention, and overhead, multiplied for RAID redundancy, and billed in whole drives.",
  "Cloud connector appliances are needed at least one per site. When a vendor sells several connector models, the cheapest that covers the cameras at the scenario's retention is used; a model holding fewer days than needed serves proportionally fewer cameras.",
  "Each solution has separate discounts off list for hardware (cameras, connectors, servers, storage) and for software (licenses, subscriptions, support renewals).",
  "Cameras fail at a steady rate set by each fleet's half-life, and replacement cameras can fail again. Each batch of cameras has its own warranty, counted from when it was installed; cameras already on site start at the age entered for them. A failure under warranty costs only replacement labor.",
  "On-prem support renewals and all other recurring costs are charged every year. Prices grow at three separate escalation rates: one for labor and services, one for hardware, and one for licenses and subscriptions.",
  "Purchases with a fixed service life that runs past the horizon are credited for their unused share in the final year, unless that option is turned off.",
  "Cloud solutions are assumed to include AI video search in their license. On-prem solutions include it only when analytics is turned on, which adds analytics hardware and software costs and the faster with-search investigation time together.",
  "Electricity is each solution's average power draw per camera, running all year, at the scenario's rate per kWh. Both solutions start from the same placeholder draw, so it only changes the comparison once their real figures are entered.",
  "Admin and investigation labor are estimates of staff time, shown separately from cash costs.",
  "Business impact is optional and industry-specific. Each solution's change to a cost the business has today (theft, claims, guards) is a percentage of that cost, and new costs it brings are entered directly. Changes start in year 1, grow with labor escalation, and are shown separately from cash costs. The incumbent has no change, since today's figures already reflect it. Benefits that are revenue or have no credible dollar figure are listed as other considerations and never added to a total.",
  "Defaults are directional placeholders, not quotes. This tool is not affiliated with or endorsed by any vendor named here.",
];
