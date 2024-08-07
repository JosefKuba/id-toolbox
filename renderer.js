const { ipcRenderer } = require('electron');

document.getElementById('query').addEventListener('click', () => {
    var outputText = document.getElementById('outputText');
    outputText.value = '查询中...';

    let idContent = document.getElementById('inputText').value;

    if (idContent) {
        ipcRenderer.send('read-file', idContent);
    }
});

ipcRenderer.on('file-content', (event, fileContent) => {
    document.getElementById('outputText').value = fileContent;
});

// 检查更新
ipcRenderer.on('id-update-check', (event, content) => {
    document.getElementById('sf-status').innerText = content;
});

// ID正在更新
ipcRenderer.on('id-update', (event, content) => {
    document.getElementById('sf-status').innerText = content;
});

// 下载ID包 
ipcRenderer.on('id-update-download', (event, content) => {
    document.getElementById('sf-status').innerText = content;
});

// 解压ID包
ipcRenderer.on('id-update-unzip', (event, content) => {
    document.getElementById('sf-status').innerText = content;
});

// 更新成功
ipcRenderer.on('id-update-success', (event, content) => {
    document.getElementById('sf-status').innerText = content;
});
