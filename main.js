const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');

// 自动重载应用
require('electron-reload')(__dirname, {
    electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
});

let mainWindow;

// 定义菜单
const menuTemplate = [
    {
        label: '文件',
        submenu: [
            {
                label: '关于',
                click: () => {
                    console.log('关于应用');
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
        label: '工作区',
        submenu: [
            {
                label: '匹配中文名称',
                click: () => {
                    mainWindow.loadFile('chinese-names.html');
                }
            },
            {
                label: 'ID比较工具',
                click: () => {
                    mainWindow.loadFile('id-compare.html');
                }
            },
            {
                label: '好友ID查询',
                click: () => {
                    mainWindow.loadFile('index.html');
                }
            },
        ]
    },
    {
        label: '帮助',
        submenu: [
            {
                label: '使用说明',
                click: () => {
                    console.log('关于应用');
                }
            },
            {
                label: '问题反馈',
                click: () => {
                    console.log('关于应用');
                }
            }
        ]
    }
];

// 定义配置文件
const configFile = path.join(app.getPath('userData'), 'config.json');
if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({ friendGoogleId: "", friendGoogleDate: "" }), 'utf-8');
}

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
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'assets/icons/png/64x64.png')
    });

    mainWindow.loadFile('index.html');

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

    mainWindow.webContents.send("id-update-check", "检查ID是否需要更新");

    axios.get(url)
        .then(response => {

            let data = response.data
            let configData = JSON.parse(fs.readFileSync(configFile).toString());

            if (configData.friendGoogleId == data.GoogleId) {
                console.log("好友数据无需更新");
                return;
            }

            console.log("好友数据更新中...");

            mainWindow.webContents.send("id-update", "ID数据更新中");

            // 下载数据文件，并更新配置文件
            let downloadUrl = "https://drive.usercontent.google.com/download?id=" + data.GoogleId + "&export=download&authuser=0&confirm=t"

            const zipFilePath = path.join(downloadDir, 'friends.zip');

            // 下载文件前先删除文件
            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }

            async function downloadFile() {
                mainWindow.webContents.send("id-update-download", "ID文件下载中");
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
                }
            }

            downloadFile()
                .then(() => {
                    console.log('文件下载成功:', zipFilePath);

                    async function unzipFile(zipFilePath, extractToPath) {

                        mainWindow.webContents.send("id-update-unzip", "ID文件解压中");

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
                                            })
                                            .catch(err => {
                                                console.error('friends 目录移动失败:', err);
                                            });

                                        // 删除 friends.zip
                                        fs.unlinkSync(zipFilePath);

                                        // 更新 config.json
                                        configData.friendGoogleId = data.GoogleId;
                                        configData.friendGoogleDate = data.GoogleDate;
                                        fs.writeFileSync(configFile, JSON.stringify(configData), 'utf-8');

                                        mainWindow.webContents.send("id-update-success", "就绪");
                                    })
                                    .catch((err) => {
                                        console.log("删除 friends 目录失败", err)
                                    })
                            })
                            .on('error', (err) => {
                                console.error('解压失败:', err);
                            });
                    }

                    unzipFile(zipFilePath, downloadDir);
                })
                .catch((error) => {
                    console.error('文件下载失败 - 2:', error);
                });
        }).catch(error => {
            console.error('Error: ' + error.message);
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
                idStr += fileContent + "\r";
            }
        } catch (err) {
            console.log(filePath + "不存在")
        }
    }

    // 处理多余空行
    idStr = idStr.trim("\r")

    event.sender.send('file-content', idStr);
});
