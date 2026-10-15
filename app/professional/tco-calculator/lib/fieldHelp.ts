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

export const STORAGE_PRICE_HELP =
  "Price per terabyte of raw drive capacity. Storage is sized from bitrate and retention, multiplied for RAID redundancy, and billed in whole drives, so use a raw-drive price here, not a per-usable-TB quote, or the RAID overhead is counted twice.";

export const BITRATE_HELP =
  "Average recorded bitrate per camera, as your cameras or VMS report it. It already reflects resolution, codec, frame rate, and motion, so there's no separate frame-rate setting. Only used to size on-prem storage; cloud storage is priced into the license.";

export const STAFF_TIME_NOTE =
  "Admin and investigation labor are estimates of staff time rather than invoices, so they're shown separately from cash costs.";

export const HALF_LIFE_HELP =
  "How long until about half of a batch of cameras has failed, half of the rest by twice that, and so on. By default it's 1.5 times the warranty period for every vendor, and it follows the warranty when that changes, unless you set your own number here.";

export const RAID_HELP =
  "How on-prem storage survives a drive failure. RAID 5 and 6 add one or two parity drives per array, the usual NVR setup. RAID 1 and 10 mirror everything, doubling the drives. No RAID and RAID 0 have no redundancy, so a single drive failure loses footage. The minimum array size applies to each recording server's own storage.";

export const RAID_ARRAY_HELP =
  "How many drives make up one RAID 5 or 6 array. Each array spends one (RAID 5) or two (RAID 6) drives on parity, so bigger arrays have less overhead.";

export const NETWORK_HELP =
  "Extra internet or WAN cost per site per year that this solution needs and the other may not, such as more upload bandwidth for a vendor that records continuously to the cloud. Leave at 0 if it's the same either way.";

export const SERVER_SOFTWARE_HELP =
  "Software bought with each server: Windows Server, SQL Server, and any other OS or database licensing the VMS needs. Charged for every recording and management server, and again at each refresh.";

export const MANAGEMENT_SERVERS_HELP =
  "Servers that don't record video but the VMS needs, such as a management or database server and its failover. Bought at the recording-server price plus server software, and refreshed with them.";
