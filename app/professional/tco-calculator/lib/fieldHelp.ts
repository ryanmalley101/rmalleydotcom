// Help text shared by the wizard (SolutionsStep/ScenarioStep) and the results
// page (AssumptionsPanel), so the same field explains itself the same way in
// both places.

export const TRUCK_ROLLS_HELP =
  "Paid site visits per site per year for anything other than swapping a failed camera (servers, NVRs, connectors, network issues). Camera swaps are already counted under replacement labor. The on-prem and cloud defaults differ by deployment model and aren't sourced, so replace them with your own numbers where you can.";

export const ADMIN_HOURS_HELP =
  "Staff hours per camera per year spent administering the system: patching, user management, health checks, firmware. The on-prem and cloud defaults differ by deployment model and aren't sourced, so replace them with your own numbers where you can.";

export const INVESTIGATION_HOURS_HELP =
  "Staff hours to find and export the footage for one investigation. This is often the largest single difference between two solutions, and the on-prem and cloud defaults differ by deployment model without a source. Replace them with your own numbers where you can.";

export const INVESTIGATIONS_PER_MONTH_HELP =
  "How many times a month someone searches footage for an incident, across all sites. Multiplied by each solution's hours per investigation and the investigator rate.";

export const STAFF_TIME_NOTE =
  "Admin and investigation labor are estimates of staff time rather than invoices, so they're shown separately from cash costs.";
