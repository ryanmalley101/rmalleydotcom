import { defineAuth } from "@aws-amplify/backend";

type MfaMode = "OFF" | "OPTIONAL" | "REQUIRED";
// Override at deploy time: MFA_MODE=REQUIRED npx ampx sandbox
const mfaMode: MfaMode = (process.env.MFA_MODE as MfaMode) ?? "OPTIONAL";

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // multifactor's type is a discriminated union: `{ mode: "OFF" }` on its own,
  // or `{ mode: "OPTIONAL" | "REQUIRED" }` combined with settings like `totp`.
  // Branching here (rather than always spreading `totp: true`) lets each
  // branch narrow to the shape that union member actually accepts.
  multifactor: mfaMode === "OFF" ? { mode: "OFF" } : { mode: mfaMode, totp: true },
});
