import nextConfig from "eslint-config-next";

const config = [
  // Generated output — Amplify's CDK synth assets and Next's build dir.
  { ignores: [".amplify/**", ".next/**", "roll20-bridge/dist/**"] },
  ...nextConfig,
];

export default config;
