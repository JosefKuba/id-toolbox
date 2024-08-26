const { app } = require('electron');
const fs = require('fs-extra');
const path = require('path');

// 配置文件的路径
let configFile = path.join(app.getPath('userData'), 'config.json');
if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({ friendGoogleId: "", friendGoogleDate: "", remoteUrl:"" }), 'utf-8');
}

// 定义存放ID文件的目录
let friendIdDir = path.join(app.getPath('userData'), 'friends');
if (!fs.existsSync(friendIdDir)) {
    fs.mkdirSync(friendIdDir);
}

// 定义下载文件的目录
let downloadDir = path.join(app.getPath('userData'), 'download');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

module.exports = {
    configFile,
    friendIdDir,
    downloadDir
}