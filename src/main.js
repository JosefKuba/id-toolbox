const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');
const { EVDInit } = require("electron-version-deployer-cli/dist/main");
const {menuTemplate} = require("./packages/menu");

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

let mainWindow, settingsWindow;

// 定义配置文件
const configFile = path.join(app.getPath('userData'), 'config.json');
if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({ friendGoogleId: "", friendGoogleDate: "" }), 'utf-8');
}

// 远程配置的文件地址，给一个默认配置
let remoteUrl = JSON.parse(fs.readFileSync(configFile)).remoteUrl || ""

// 定义存放ID文件的目录
const friendIdDir = path.join(app.getPath('userData'), 'friends');
if (!fs.existsSync(friendIdDir)) {
    fs.mkdirSync(friendIdDir);
}

// 定义下载文件的目录
const downloadDir = path.join(app.getPath('userData'), 'download');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 680,
        webPreferences: {
            // preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'src/assets/icons/png/64x64.png')
    });

    mainWindow.loadFile('src/pages/friend-ids/index.html');

    return mainWindow;
}

function createSettingsWindow() {
    settingsWindow = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,       // 禁用窗口大小调整（去掉最大化按钮）
        minimizable: false,     // 禁用最小化按钮
        maximizable: false,     // 禁用最大化按钮
        webPreferences: {
            // preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'src/assets/icons/png/64x64.png')
    });

    settingsWindow.loadFile('src/pages/settings.html');

    settingsWindow.setMenu(null);

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// 监听渲染进程请求获取远程配置 URL
ipcMain.handle('get-remote-url', () => {
    const config = JSON.parse(fs.readFileSync(configFile))
    return config.remoteUrl || ""
});

// 监听渲染进程请求保存远程配置 URL
ipcMain.on('save-remote-url', (event, url) => {
    try {
        const config = JSON.parse(fs.readFileSync(configFile))
        const remoteUrl = config.remoteUrl || ""
        if (url !== remoteUrl) {
            config.remoteUrl = url
            fs.writeFileSync(configFile, JSON.stringify(config), "utf-8")

            app.relaunch(); // 重新启动应用
            app.quit(); // 退出应用
        }
    } catch (error) {
        console.log(error)
    }

    // 保存成功后，关闭窗口
    event.sender.send('close-settings-window');
});

// 关闭设置窗口的函数
ipcMain.on('close-settings-window', () => {
    if (settingsWindow) {
        settingsWindow.close();
        settingsWindow = null;
    }
});

// 打开设置窗口的函数（可以从菜单或按钮中调用）
function openSettingsWindow() {
    if (!settingsWindow) {
        createSettingsWindow();
    } else {
        settingsWindow.focus();
    }
}

app.whenReady().then(() => {

    mainWindow = createWindow();

    const menu = Menu.buildFromTemplate(menuTemplate({mainWindow, openSettingsWindow}));
    Menu.setApplicationMenu(menu);

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // 获取数据链接
    if (!remoteUrl) {
        console.log("remote: ", remoteUrl)
        mainWindow.webContents.send("id-update", "缺少配置链接");
        return;
    }

    const url = remoteUrl + '/friendId.json';

    mainWindow.webContents.send("id-update", "检查更新中...");

    axios.get(url)
        .then(response => {

            let data = response.data
            let configData = JSON.parse(fs.readFileSync(configFile).toString());

            if (configData.friendGoogleId == data.GoogleId) {
                console.log("friend data is latest");
                mainWindow.webContents.send("id-update", "就绪");
                return;
            }

            console.log("update friend data ...");


            // 下载数据文件，并更新配置文件
            let downloadUrl = "https://drive.usercontent.google.com/download?id=" + data.GoogleId + "&export=download&authuser=0&confirm=t"

            const zipFilePath = path.join(downloadDir, 'friends.zip');

            // 下载文件前先删除文件
            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }

            async function downloadFile() {
                try {
                    const response = await axios({
                        url: downloadUrl,
                        method: 'GET',
                        responseType: 'stream',
                    });

                    const writer = fs.createWriteStream(zipFilePath);

                    response.data.pipe(writer);

                    return new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });
                } catch (error) {
                    console.error('文件下载失败 - 1:', error);
                    mainWindow.webContents.send("id-update", "文件下载失败 - 1");
                }
            }

            mainWindow.webContents.send("id-update", "ID文件下载中...");

            downloadFile()
                .then(() => {
                    console.log('文件下载成功:', zipFilePath);

                    mainWindow.webContents.send("id-update", "ID文件解压中...");

                    async function unzipFile(zipFilePath, extractToPath) {
                        fs.createReadStream(zipFilePath)
                            .pipe(unzipper.Extract({ path: extractToPath }))
                            .on('close', () => {

                                console.log('解压完成');

                                // 删除 friendIdDir
                                fs.remove(friendIdDir)
                                    .then(() => {
                                        console.log('friends 目录删除完成');

                                        // 移动 friendIdDir
                                        fs.move(path.join(downloadDir, "friends"), friendIdDir)
                                            .then(() => {
                                                console.log('friends 目录移动完成');
                                                mainWindow.webContents.send("id-update", "friends 目录移动完成");
                                            })
                                            .catch(err => {
                                                console.error('friends 目录移动失败:', err);
                                                mainWindow.webContents.send("id-update", "friends 目录移动失败");
                                            });

                                        // 删除 friends.zip
                                        fs.unlinkSync(zipFilePath);

                                        // 更新 config.json
                                        configData.friendGoogleId = data.GoogleId;
                                        configData.friendGoogleDate = data.GoogleDate;
                                        fs.writeFileSync(configFile, JSON.stringify(configData), 'utf-8');

                                        mainWindow.webContents.send("id-update", "就绪");
                                    })
                                    .catch((err) => {
                                        console.log("删除 friends 目录失败", err)
                                        mainWindow.webContents.send("id-update", "删除 friends 目录失败");
                                    })
                            })
                            .on('error', (err) => {
                                console.error('解压失败:', err);
                                mainWindow.webContents.send("id-update", "解压失败");
                            });
                    }

                    unzipFile(zipFilePath, downloadDir);
                })
                .catch((error) => {
                    console.error('文件下载失败 - 2:', error);
                    mainWindow.webContents.send("id-update", "文件下载失败 - 2");
                });
        }).catch(error => {
            console.error('Error: ' + error.message);
            mainWindow.webContents.send("id-update", "检查更新失败. 请确保配置链接正确填写");
        });
});


app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});


ipcMain.on('read-file', async (event, idContent) => {

    let ids = idContent.split(/\r?\n/);

    let idStr = "";
    for (let i = 0; i < ids.length; i++) {
        let id = ids[i].trim();

        // 过滤掉没有分隔符的行
        if (id.length === 0) {
            continue;
        }

        let filePath = friendIdDir + "/" + id;

        try {
            let fileContent = fs.readFileSync(friendIdDir + "/" + id, 'utf-8');
            if (fileContent) {
                idStr += fileContent + "\n";
            }
        } catch (err) {
            idStr = id + "\t不存在\n" + idStr
        }
    }

    // 去重
    let uniqueArr = [...new Set(idStr.split(/\r?\n/))];

    // 移除空
    uniqueArr = uniqueArr.filter(Boolean)

    let result;
    if (uniqueArr.length == 0) {
        result = "无结果"
    } else {
        result = uniqueArr.join("\n")
    }

    event.sender.send('file-content', result);
});

