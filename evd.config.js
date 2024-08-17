import { defineEVDConfig } from "electron-version-deployer-cli";

export default defineEVDConfig({
  compileCommand: "compile:mac",
  changelogsPath: "CHANGELOG.md",
  sources: {
    folder: "dist/mac-arm64/idtoolbox.app/Resources/app",
    nodeModules: "node_modules",
    codes: "build",
    packageJSON: "package.json",
  },
  netlify: {
    url: "",
    token: "",
    siteID: "",
  },
  cloudflare: {
    url: "",
    token: "",
    projectName: "",
  },
  prebuiltConfig: {},
});
