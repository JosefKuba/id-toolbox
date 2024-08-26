const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');
const packageJson = require('./../package.json'); // 引入 package.json 以获取版本号

const { configFile, friendIdDir, downloadDir } = require("./packages/const")
require("./packages/upgrade")
require("./packages/get-friend-id")

let mainWindow;
let settingsWindow;

// 远程配置的文件地址，给一个默认配置
let remoteUrl = JSON.parse(fs.readFileSync(configFile)).remoteUrl || ""

// 定义菜单
const menuTemplate = [
    {
        label: '文件', 
        submenu: [
            {
                label: '设置',
                click() {
                    openSettingsWindow();
                }
            },
            {
                label: '退出',
                role: 'quit'
            }
        ]
    },
    {
        label: '编辑',
        submenu: [
            { role: 'cut', label: '剪切' },
            { role: 'copy', label: '复制' },
            { role: 'paste', label: '粘贴' },
            { role: 'delete', label: '删除' },
            { role: 'selectAll', label: '全选' }
        ]
    },
    {
        label: '功能',
        submenu: [
            {
                label: '好友ID查询',
                click: () => {
                    mainWindow.loadFile('src/pages/friend-ids/index.html');
                }
            },
            {
                label: 'ID比较工具',
                click: () => {
                    mainWindow.loadFile('src/pages/id-compare/index.html');
                }
            },
            {
                label: '匹配中文名称',
                click: () => {
                    mainWindow.loadFile('src/pages/chinese-names/index.html');
                }
            },
            {
                label: '关键词匹配工具',
                click: () => {
                    mainWindow.loadFile('src/pages/keywords-select/index.html');
                }
            }
        ]
    },
    {
        label: '帮助',
        submenu: [
            {
                label: '使用说明',
                click: () => {
                    shell.openExternal("https://docs.google.com/document/d/1ssxfJXgi2wnVs9peMa2u2pzwgSOHVZRQ4C7UBuNx7r4/edit");
                }
            },
            {
                label: '问题反馈',
                click: () => {
                    shell.openExternal("https://docs.google.com/spreadsheets/d/1DSqhoY1uVN3Kq0x73e_BZz4EQ6Kte8b2tL7_YLKVDbo/edit?gid=1236144827");
                }
            },
            {
                label: '开发者工具',
                // accelerator: 'CmdOrCtrl+I',  // 使用快捷键 CmdOrCtrl+I 打开开发者工具
                click: () => {
                    mainWindow.webContents.openDevTools(); // 打开开发者工具
                }
            }
        ]
    }
];

function createMainWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 680,
        title: `${packageJson.build.productName} - v${packageJson.version}`,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'src/assets/icons/png/64x64.png')
    });


    mainWindow.loadFile('src/pages/friend-ids/index.html');

    // todo close
    // mainWindow.webContents.openDevTools();

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
            preload: path.join(__dirname, 'preload.js'),
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

    mainWindow = createMainWindow();

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
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


