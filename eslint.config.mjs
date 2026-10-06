import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".agents/**",
      ".codex/**",
      ".rybexos-local/**",
      ".tmp/**",
      "artifacts/**",
      "dist-demo/**",
      "out/**",
      "package-output/**",
      "visual-qa-output/**",
      "scripts/temp-*.mjs",
      "components/d5o/workflow/WorkflowTransactionRuntime.tsx"
    ]
  },
  ...nextVitals
];

export default eslintConfig;
