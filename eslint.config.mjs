import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: ["package-output/**", "dist-demo/**"]
  },
  ...nextVitals
];

export default eslintConfig;
