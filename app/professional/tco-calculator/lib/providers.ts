// Common vendor names offered in the wizard's naming dropdowns, purely for
// labeling. None of these drive different default numbers yet ("Other" lets
// the user type any name; per-provider default pricing is a later pass).

export const CLOUD_PROVIDERS = [
  "Verkada",
  "Rhombus",
  "Meraki (Cisco)",
  "Eagle Eye Networks",
  "Avigilon Alta (Motorola Solutions)",
  "Arcules",
  "Spot AI",
  "Coram AI",
  "Turing AI",
  "Camio",
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
  "Digital Watchdog (DW Spectrum)",
  "Hanwha Wisenet WAVE",
  "ISS (SecurOS)",
  "3xLOGIC (VIGIL)",
];

export const ONPREM_CAMERA_PROVIDERS = [
  "Axis Communications",
  "Hanwha Vision",
  "Bosch Security",
  "Hikvision",
  "Dahua Technology",
  "Pelco",
  "Vivotek",
  "Uniview",
  "i-PRO (ex-Panasonic)",
  "Honeywell",
  "Avigilon (Cameras)",
];
