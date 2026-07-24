import { defineAuth } from "@aws-amplify/backend";

type MfaMode = "OFF" | "OPTIONAL" | "REQUIRED";
// Override at deploy time: MFA_MODE=OPTIONAL npx ampx sandbox
const mfaMode: MfaMode = (process.env.MFA_MODE as MfaMode) ?? "REQUIRED";

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  multifactor: {
    mode: mfaMode,
    totp: true,
  },
});
