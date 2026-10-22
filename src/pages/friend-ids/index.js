document.getElementById('query').addEventListener('click', () => {
    const outputText = document.getElementById('outputText');
    outputText.value = '查询中...';

    let idContent = document.getElementById('inputText').value;

    if (idContent) {
        window.idToolbox.queryFriendIds(idContent);
    }
});

window.idToolbox.onFileContent((fileContent) => {
    document.getElementById('outputText').value = fileContent;
});

window.idToolbox.onIdUpdate((content) => {
    document.getElementById('sf-status').innerText = content;
});
