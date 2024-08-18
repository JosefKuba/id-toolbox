import { defineEVDConfig } from "electron-version-deployer-cli";

export default defineEVDConfig({
  compileCommand: "build:win",
  changelogsPath: "CHANGELOG.md",
  sources: {
    folder: "dist/win-unpacked/resources/app",
    nodeModules: "node_modules",
    codes: "packages",
    packageJSON: "package.json",
  },
  netlify: {
    url: "",
    token: "",
    siteID: "",
  },
  cloudflare: {
    url: "https://id-toolbox.pages.dev",
    token: "s3TM3hbD8xbRYSk6cXeRiFEOOe3nS8I2tf2lJljq",
    projectName: "id-toolbox",
  },
  prebuiltConfig: {},
});
