module.exports = {
  extends: ["next", "next/core-web-vitals", "prettier"],
  ignorePatterns: ["node_modules", ".next", "dist"],
  rules: {
    "react/no-unescaped-entities": "off",
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-img-element": "off",
    "react-hooks/exhaustive-deps": "off",
    "no-restricted-syntax": [
      "error",
      {
        selector: "TSAnyKeyword",
        message: "Explicit any types are not allowed.",
      },
      {
        selector: "TSAsExpression",
        message: "Type assertions are not allowed.",
      },
      {
        selector: "TSTypeAssertion",
        message: "Type assertions are not allowed.",
      },
    ],
  },
};
