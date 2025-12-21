module.exports = {
  extends: ["next", "next/core-web-vitals"],
  ignorePatterns: ["node_modules", ".next", "dist"],
  rules: {
    "react/no-unescaped-entities": "off",
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-img-element": "off",
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react-hooks/immutability": "off",
    "react-hooks/set-state-in-effect": "off",
  },
};
