const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("idToolbox", {
    queryFriendIds(idContent) {
        ipcRenderer.send("read-file", idContent);
    },
    onFileContent(callback) {
        ipcRenderer.on("file-content", (_event, content) => callback(content));
    },
    onIdUpdate(callback) {
        ipcRenderer.on("id-update", (_event, content) => callback(content));
    },
    getRemoteUrl() {
        return ipcRenderer.invoke("get-remote-url");
    },
    saveRemoteUrl(url) {
        ipcRenderer.send("save-remote-url", url);
    },
    onSaveRemoteUrlError(callback) {
        ipcRenderer.on("save-remote-url-error", () => callback());
    },
    onCloseSettings(callback) {
        ipcRenderer.on("close-settings-window", () => callback());
    },
    requestCloseSettings() {
        ipcRenderer.send("close-settings-window");
    },
});
