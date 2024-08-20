const os = require("os")
import { defineEVDConfig } from "electron-version-deployer-cli";

let folder, compileCommand

switch (os.platform()) {
  case "win32":
    folder = "dist/win-unpacked/resources/app"
    compileCommand = "build:win"
    break;
  case "darwin":
    folder = "dist/mac/ID工具箱.app/Contents/Resources/app"
    compileCommand = "build:mac"
    break;
  // case "linux":
  //   folder = ""
  //   compileCommand = "build:linux"
  //   break;
}

export default defineEVDConfig({
  compileCommand: compileCommand,
  changelogsPath: "CHANGELOG.md",
  sources: {
    folder: folder,
    nodeModules: "node_modules",
    codes: "packages",
    packageJSON: "package.json",
  },
  cloudflare: {
    url: "https://id-toolbox.pages.dev",
    token: "s3TM3hbD8xbRYSk6cXeRiFEOOe3nS8I2tf2lJljq",
    projectName: "id-toolbox",
  },
  prebuiltConfig: {},
});
