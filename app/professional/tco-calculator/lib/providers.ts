// Common vendor names offered in the wizard's naming dropdowns, purely for
// labeling. None of these drive different default numbers yet ("Other" lets
// the user type any name; per-provider default pricing is a later pass).

export const CLOUD_PROVIDERS = [
  "Verkada",
  "Rhombus",
  "Meraki (Cisco)",
  "Eagle Eye Networks",
  "Ava Security (Motorola Solutions)",
  "Arcules",
];

// On-prem deployments separate the VMS software from the camera hardware.
export const ONPREM_VMS_PROVIDERS = [
  "Milestone XProtect",
  "Genetec Security Center",
  "Avigilon Control Center (Motorola Solutions)",
  "Exacq (Johnson Controls)",
  "Network Optix (Nx Witness)",
  "Salient Systems",
  "Qognify",
];

export const ONPREM_CAMERA_PROVIDERS = [
  "Axis Communications",
  "Hanwha Vision",
  "Bosch Security",
  "Hikvision",
  "Dahua Technology",
  "Pelco",
  "Vivotek",
];
