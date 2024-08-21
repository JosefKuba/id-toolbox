const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');

const { configFile, friendIdDir, downloadDir } = require("./packages/const")
require("./packages/upgrade")
require("./packages/get-friend-id")

let mainWindow;

// 定义菜单
const menuTemplate = [
    {
        label: '文件',
        submenu: [
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
                label: '关键词过滤',
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
            }
        ]
    }
];

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 680,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'src/assets/icons/png/64x64.png')
    });


    mainWindow.loadFile('src/pages/friend-ids/index.html');
    // mainWindow.loadFile('src/pages/keywords-select/index.html');

    // todo close
    // mainWindow.webContents.openDevTools();

    return mainWindow;
}

app.whenReady().then(() => {

    mainWindow = createWindow();

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // 获取数据链接
    const url = 'https://id-toolbox-default-rtdb.europe-west1.firebasedatabase.app/friendId.json';

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
            mainWindow.webContents.send("id-update", "检查更新失败");
        });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});


