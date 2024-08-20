const path        = require('path');
const { app }     = require('electron');
const { EVDInit } = require("electron-version-deployer-cli/dist/main");

EVDInit({
    remoteUrl: "https://id-toolbox.pages.dev",
    logo: `file://${path.join(
        app.getAppPath(),
        "src",
        "assets",
        "icons",
        "icon.png"
    )}`,
    onError(error) {
        //  记录更新检测遇到的错误
        // writeError(error, "evd");
        console.log("check update error...")
        console.log(error)
    },
});