const { ipcRenderer } = require('electron');

 // Load the saved remote URL when the page loads
 ipcRenderer.invoke('get-remote-url').then((url) => {
    if (!url) {
        // document.getElementById('sf-status').innerText = "缺少配置链接";
        return;
    }

    const firebaseUrl = url +  '/keywrods.json';

    // console.log(firebaseUrl)

    // 从 firebase 获取关键词列表
    fetchData(firebaseUrl).then(data => {
        if (data) {
            keywordsApi = data.api

            let sheetNames = data.sheetNames

            let optionsHtml = `<option value="" selected>--</option>`
            for (let i = 0; i < sheetNames.length; i++) {
                if (!sheetNames[i]) {
                    continue;
                }
                optionsHtml += `<option value="${sheetNames[i]}">${sheetNames[i]}</option>`
            }

            document.getElementById("keywords-select").innerHTML = optionsHtml
        }
    });
});


let keywordsApi

async function fetchData(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        // document.getElementById('sf-status').innerText = "获取配置失败，请检查配置链接是否正确";
        console.error('Error fetching data:', error);
    }
}

// 获取下拉框和文本区域元素
const keywordsSelect = document.querySelector('#keywords-select');
const keywordsTextArea = document.querySelector('#keywords');

// 处理下拉框值变化事件
keywordsSelect.addEventListener('change', function () {
    let value = keywordsSelect.value;

    // 过滤 value 为空
    if (!value) {
        keywordsTextArea.value = "";
        return;
    }

    // 显示加载中的提示
    keywordsTextArea.value = "关键词加载中...";

    // 构建 Google API 请求 URL
    let googleApi = `${keywordsApi}?type=${value}`;

    // 请求数据并处理
    fetchData(googleApi)
        .then(data => {
            // 处理数据
            let keywords = "";

            for (const item of data) {
                if (item) {
                    keywords += item + "\n";
                }
            }

            keywordsTextArea.value = keywords;
        })
        .catch(error => {
            // 处理请求错误
            console.error("Error fetching data:", error);
            keywordsTextArea.value = "加载失败，请稍后重试。";
            // document.getElementById('sf-status').innerText = "获取配置失败，请检查配置链接是否正确";
        });
});


function performQuery(selectMatch) {
    var outputText = document.getElementById('outputText');
    outputText.value = '处理中...';

    var inputAll = document.getElementById('inputText').value;
    var keywords = document.getElementById('keywords').value;

    var result = queryFunction(inputAll, keywords, selectMatch);

    document.getElementById('outputText').value = result;
}

function copyOutput() {
    var outputText = document.getElementById('outputText');
    outputText.select();
    document.execCommand('copy');
}

function clearInputAndOutput() {
    var outputText = document.getElementById('outputText');
    outputText.value = '';

    var inputText = document.getElementById('inputText');
    inputText.value = '';
}

// 挑选关键词
function queryFunction(input, keywords, selectMatch) {

    let lines = input.split(/\r?\n/);
    keywords = keywords.split(/\r?\n/);

    let result = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        let regexString = keywords.filter(keyword => keyword != "").map(keyword => escapeRegExp(keyword)).join('|');

        let regex = new RegExp('(' + regexString + ')');

        if (selectMatch) {
            if (!regex.test(line)) {
                continue;
            }
    
            result.push(line);
        } else {
            if (!regex.test(line)) {
                result.push(line);
            }
    
            continue;
        }

    }

    if (result.length === 0) {
        return "无匹配行";
    }

    return result.join("\n");
}

// 转义正则表达式中特殊字符的函数
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& 表示匹配到的子字符串
}

