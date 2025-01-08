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

// 更新软件状态
ipcRenderer.on('id-update', (event, content) => {
    document.getElementById('sf-status').innerText = content;
});