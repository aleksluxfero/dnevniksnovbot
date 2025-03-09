import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Extend existing Next.js and TypeScript configs
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Add Prettier recommended config
  ...compat.extends("plugin:prettier/recommended"),
  // Add Prettier plugin and custom rule
  {
    plugins: ["prettier"],
    rules: {
      "prettier/prettier": "error",
    },
  },
];

export default eslintConfig;
