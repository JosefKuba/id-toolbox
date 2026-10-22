const {app, BrowserWindow, ipcMain, Menu, shell} = require('electron');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');
const {EVDInit} = require("electron-version-deployer-cli/dist/main");
const {menuTemplate} = require("./packages/menu");
const {
    MAX_ID_QUERY_CHARS,
    MAX_ZIP_ENTRIES,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    MAX_DOWNLOAD_BYTES,
    isAllowedRemoteUrl,
    friendIndexUrl,
    isGoogleFileId,
    resolveFriendIdFile,
    safeZipDestination,
    errorMessage,
} = require("./security");

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
        console.log("check update error...")
        console.log(errorMessage(error))
    },
});

let mainWindow, settingsWindow;

const configFile = path.join(app.getPath('userData'), 'config.json');
if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({friendGoogleId: "", friendGoogleDate: ""}), 'utf-8');
}

let remoteUrl = "";
let remoteUrlRejected = false;
try {
    const storedRemoteUrl = JSON.parse(fs.readFileSync(configFile, "utf-8")).remoteUrl || "";
    if (isAllowedRemoteUrl(storedRemoteUrl)) {
        remoteUrl = storedRemoteUrl.trim();
    } else if (storedRemoteUrl) {
        remoteUrlRejected = true;
    }
} catch (error) {
    console.error("读取配置失败:", errorMessage(error));
}

const friendIdDir = path.join(app.getPath('userData'), 'friends');
if (!fs.existsSync(friendIdDir)) {
    fs.mkdirSync(friendIdDir);
}

const downloadDir = path.join(app.getPath('userData'), 'download');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
}

function secureWebPreferences() {
    return {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
    };
}

function hardenWebContents(contents) {
    contents.on("will-navigate", (event, url) => {
        let parsed;
        try {
            parsed = new URL(url);
        } catch {
            event.preventDefault();
            return;
        }
        if (parsed.protocol === "file:") return;
        event.preventDefault();
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
            shell.openExternal(url);
        }
    });

    contents.setWindowOpenHandler(({url}) => {
        try {
            const parsed = new URL(url);
            if (parsed.protocol === "https:" || parsed.protocol === "http:") {
                shell.openExternal(url);
            }
        } catch {
            // 忽略无法解析的地址
        }
        return {action: "deny"};
    });

    contents.on("will-attach-webview", (event) => {
        event.preventDefault();
    });
}

function isTrustedIpc(event) {
    try {
        const frameUrl = event.senderFrame && event.senderFrame.url;
        if (!frameUrl) return false;
        return new URL(frameUrl).protocol === "file:";
    } catch {
        return false;
    }
}

function readConfig() {
    return JSON.parse(fs.readFileSync(configFile, "utf-8"));
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 680,
        title: `ID工具箱 - ${app.getVersion()}`,
        webPreferences: secureWebPreferences(),
        icon: path.join(__dirname, 'src/assets/icons/png/64x64.png')
    });

    hardenWebContents(win.webContents);
    win.loadFile('src/pages/friend-ids/index.html');
    return win;
}

function createSettingsWindow() {
    settingsWindow = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,
        minimizable: false,
        maximizable: false,
        webPreferences: secureWebPreferences(),
        icon: path.join(__dirname, 'src/assets/icons/png/64x64.png')
    });

    hardenWebContents(settingsWindow.webContents);
    settingsWindow.loadFile('src/pages/settings.html');
    settingsWindow.setMenu(null);

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

ipcMain.handle('get-remote-url', (event) => {
    if (!isTrustedIpc(event)) return "";
    try {
        const config = readConfig();
        return typeof config.remoteUrl === "string" ? config.remoteUrl : "";
    } catch (error) {
        console.error("读取配置链接失败:", errorMessage(error));
        return "";
    }
});

ipcMain.on('save-remote-url', (event, url) => {
    if (!isTrustedIpc(event)) return;
    if (!isAllowedRemoteUrl(url)) {
        event.sender.send('save-remote-url-error');
        return;
    }

    try {
        const config = readConfig();
        const current = config.remoteUrl || "";
        const nextUrl = url.trim();
        if (nextUrl !== current) {
            config.remoteUrl = nextUrl;
            fs.writeFileSync(configFile, JSON.stringify(config), "utf-8");
            app.relaunch();
            app.quit();
        }
    } catch (error) {
        console.error("保存配置失败:", errorMessage(error));
        event.sender.send('save-remote-url-error');
        return;
    }

    event.sender.send('close-settings-window');
});

ipcMain.on('close-settings-window', (event) => {
    if (!isTrustedIpc(event)) return;
    if (settingsWindow) {
        settingsWindow.close();
        settingsWindow = null;
    }
});

function openSettingsWindow() {
    if (!settingsWindow) {
        createSettingsWindow();
    } else {
        settingsWindow.focus();
    }
}

function hasZipMagic(filePath) {
    const fd = fs.openSync(filePath, "r");
    try {
        const header = Buffer.alloc(4);
        const bytesRead = fs.readSync(fd, header, 0, 4, 0);
        return bytesRead >= 2 && header[0] === 0x50 && header[1] === 0x4b;
    } finally {
        fs.closeSync(fd);
    }
}

function streamEntryToFile(entry, dest, remaining) {
    return new Promise((resolve, reject) => {
        let size = 0;
        let settled = false;
        const fail = (error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        const source = entry.stream();
        const output = fs.createWriteStream(dest);
        source.on("data", (chunk) => {
            size += chunk.length;
            if (size > remaining) {
                source.destroy();
                output.destroy();
                fail(new Error("压缩包解压后体积过大"));
            }
        });
        source.on("error", fail);
        output.on("error", fail);
        output.on("finish", () => {
            if (settled) return;
            settled = true;
            resolve(size);
        });
        source.pipe(output);
    });
}

async function safeExtractZip(zipFilePath, extractToPath) {
    const root = path.resolve(extractToPath);
    const directory = await unzipper.Open.file(zipFilePath);
    const files = directory && Array.isArray(directory.files) ? directory.files : null;
    if (!files) {
        throw new Error("无法读取压缩包");
    }
    if (files.length > MAX_ZIP_ENTRIES) {
        throw new Error("压缩包文件数量过多");
    }

    let declared = 0;
    for (const entry of files) {
        const size = Number(entry.uncompressedSize || 0);
        if (Number.isFinite(size) && size > 0) declared += size;
    }
    if (declared > MAX_ZIP_UNCOMPRESSED_BYTES) {
        throw new Error("压缩包解压后体积过大");
    }

    let written = 0;
    for (const entry of files) {
        const dest = safeZipDestination(root, entry.path);
        if (!dest) {
            throw new Error("压缩包包含不安全路径");
        }
        if (entry.type === "Directory") {
            await fs.ensureDir(dest);
            continue;
        }
        if (entry.type !== "File") {
            throw new Error("压缩包包含不支持的条目");
        }
        await fs.ensureDir(path.dirname(dest));
        written += await streamEntryToFile(entry, dest, MAX_ZIP_UNCOMPRESSED_BYTES - written);
    }
}

function sendStatus(message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("id-update", message);
    }
}

async function downloadFriendArchive(downloadUrl, zipFilePath) {
    const response = await axios({
        url: downloadUrl,
        method: "GET",
        responseType: "stream",
        timeout: 60000,
        maxRedirects: 5,
        maxContentLength: MAX_DOWNLOAD_BYTES,
        maxBodyLength: MAX_DOWNLOAD_BYTES,
    });

    let received = 0;
    await new Promise((resolve, reject) => {
        let settled = false;
        const writer = fs.createWriteStream(zipFilePath);
        const finish = (error) => {
            if (settled) return;
            settled = true;
            if (error) {
                response.data.destroy();
                writer.destroy();
                reject(error);
                return;
            }
            resolve();
        };
        response.data.on("data", (chunk) => {
            received += chunk.length;
            if (received > MAX_DOWNLOAD_BYTES) {
                finish(new Error("下载文件过大"));
            }
        });
        response.data.on("error", finish);
        writer.on("error", finish);
        writer.on("finish", () => finish());
        response.data.pipe(writer);
    });
}

async function updateFriendData(data) {
    if (!data || !isGoogleFileId(data.GoogleId)) {
        sendStatus("好友数据格式无效");
        return;
    }

    let configData;
    try {
        configData = readConfig();
    } catch (error) {
        console.error("读取配置失败:", errorMessage(error));
        sendStatus("读取配置失败");
        return;
    }

    if (configData.friendGoogleId === data.GoogleId) {
        console.log("friend data is latest");
        sendStatus("就绪");
        return;
    }

    console.log("update friend data ...");
    const downloadUrl = "https://drive.usercontent.google.com/download?id="
        + encodeURIComponent(data.GoogleId)
        + "&export=download&authuser=0&confirm=t";
    const zipFilePath = path.join(downloadDir, "friends.zip");
    const stagingDir = path.join(downloadDir, "extract-staging");

    if (fs.existsSync(zipFilePath)) {
        fs.unlinkSync(zipFilePath);
    }

    sendStatus("ID文件下载中...");
    try {
        await downloadFriendArchive(downloadUrl, zipFilePath);
    } catch (error) {
        console.error("文件下载失败:", errorMessage(error));
        sendStatus("文件下载失败");
        if (fs.existsSync(zipFilePath)) {
            fs.removeSync(zipFilePath);
        }
        return;
    }

    if (!hasZipMagic(zipFilePath)) {
        fs.removeSync(zipFilePath);
        sendStatus("下载内容不是压缩包");
        return;
    }

    sendStatus("ID文件解压中...");
    try {
        await fs.remove(stagingDir);
        await fs.ensureDir(stagingDir);
        await safeExtractZip(zipFilePath, stagingDir);

        const extractedFriends = path.join(stagingDir, "friends");
        if (!(await fs.pathExists(extractedFriends))) {
            sendStatus("解压结果缺少 friends 目录");
            return;
        }

        const backupDir = `${friendIdDir}.bak`;
        await fs.remove(backupDir);
        if (await fs.pathExists(friendIdDir)) {
            await fs.move(friendIdDir, backupDir);
        }
        try {
            await fs.move(extractedFriends, friendIdDir);
            await fs.remove(backupDir);
        } catch (moveError) {
            if (await fs.pathExists(backupDir) && !(await fs.pathExists(friendIdDir))) {
                await fs.move(backupDir, friendIdDir);
            }
            throw moveError;
        }
        configData.friendGoogleId = data.GoogleId;
        configData.friendGoogleDate = data.GoogleDate;
        fs.writeFileSync(configFile, JSON.stringify(configData), "utf-8");
        sendStatus("就绪");
    } catch (error) {
        console.error("解压失败:", errorMessage(error));
        sendStatus("解压失败");
    } finally {
        await fs.remove(stagingDir).catch(() => {});
        if (fs.existsSync(zipFilePath)) {
            fs.removeSync(zipFilePath);
        }
    }
}

app.whenReady().then(() => {
    mainWindow = createWindow();

    const menu = Menu.buildFromTemplate(menuTemplate({mainWindow, openSettingsWindow}));
    Menu.setApplicationMenu(menu);

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    const indexUrl = friendIndexUrl(remoteUrl);
    if (!indexUrl) {
        sendStatus(remoteUrlRejected ? "配置链接无效" : "缺少配置链接");
        return;
    }

    sendStatus("检查更新中...");

    axios.get(indexUrl, {
        timeout: 20000,
        maxRedirects: 5,
        maxContentLength: 2 * 1024 * 1024,
        responseType: "json",
    }).then((response) => {
        return updateFriendData(response.data);
    }).catch((error) => {
        console.error("检查更新失败:", errorMessage(error));
        sendStatus("检查更新失败. 请确保配置链接正确填写");
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('read-file', async (event, idContent) => {
    if (!isTrustedIpc(event)) return;
    if (typeof idContent !== "string" || idContent.length > MAX_ID_QUERY_CHARS) {
        event.sender.send("file-content", "输入过长");
        return;
    }

    const ids = idContent.split(/\r?\n/);
    let idStr = "";
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i].trim();
        if (id.length === 0) continue;

        const filePath = resolveFriendIdFile(friendIdDir, id);
        if (!filePath) {
            idStr = id + "\t不存在\n" + idStr;
            continue;
        }

        try {
            const fileContent = fs.readFileSync(filePath, "utf-8");
            if (fileContent) {
                idStr += fileContent + "\n";
            }
        } catch {
            idStr = id + "\t不存在\n" + idStr;
        }
    }

    let uniqueArr = [...new Set(idStr.split(/\r?\n/))];
    uniqueArr = uniqueArr.filter(Boolean);

    const result = uniqueArr.length === 0 ? "无结果" : uniqueArr.join("\n");
    event.sender.send("file-content", result);
});
