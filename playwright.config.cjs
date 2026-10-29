const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.cjs",
  workers: 1,
  timeout: 90000,
  reporter: "list",
});
