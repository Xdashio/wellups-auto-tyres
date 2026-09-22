import nextPlugin from "@next/eslint-plugin-next";

// eslint-config-next cannot load under TypeScript 7 (its bundled
// typescript-eslint rejects TS 7), so the Next plugin is wired directly.
// Only the plugin's own rules are enabled; typescript-eslint rules the
// preset references are dropped until the toolchain supports TS 7.
const nextRules = Object.fromEntries(
  Object.entries(nextPlugin.configs["core-web-vitals"].rules ?? {}).filter(([name]) =>
    name.startsWith("@next/"),
  ),
);

const eslintConfig = [
  {
    ignores: [".next/**", ".open-next/**", "node_modules/**", "coverage/**"],
  },
  {
    plugins: { "@next/next": nextPlugin },
    rules: { ...nextRules },
  },
];

export default eslintConfig;
