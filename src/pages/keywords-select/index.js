function isHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
    } catch (e) {
        return false;
    }
}

window.idToolbox.getRemoteUrl().then((url) => {
    if (!isHttpUrl(url)) {
        return;
    }

    const firebaseUrl = new URL("keywrods.json", url.endsWith("/") ? url : url + "/").href;
    if (!isHttpUrl(firebaseUrl)) {
        return;
    }

    fetchData(firebaseUrl).then(data => {
        if (!data || !Array.isArray(data.sheetNames) || !isHttpUrl(data.api)) {
            return;
        }

        keywordsApi = data.api;
        const select = document.getElementById("keywords-select");
        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.selected = true;
        placeholder.textContent = "--";
        select.appendChild(placeholder);

        for (const sheetName of data.sheetNames) {
            if (typeof sheetName !== "string" || !sheetName) {
                continue;
            }
            const option = document.createElement("option");
            option.value = sheetName;
            option.textContent = sheetName;
            select.appendChild(option);
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
        console.error('Error fetching data:', error && error.message ? error.message : "request failed");
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

    if (!isHttpUrl(keywordsApi)) {
        keywordsTextArea.value = "加载失败，请稍后重试。";
        return;
    }

    let googleApi;
    try {
        const apiUrl = new URL(keywordsApi);
        apiUrl.searchParams.set("type", value);
        googleApi = apiUrl.href;
    } catch (e) {
        keywordsTextArea.value = "加载失败，请稍后重试。";
        return;
    }

    fetchData(googleApi)
        .then(data => {
            // 处理数据
            if (!Array.isArray(data)) {
                keywordsTextArea.value = "加载失败，请稍后重试。";
                return;
            }

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
            console.error("Error fetching data:", error && error.message ? error.message : "request failed");
            keywordsTextArea.value = "加载失败，请稍后重试。";
            // document.getElementById('sf-status').innerText = "获取配置失败，请检查配置链接是否正确";
        });
});


function performQuery(selectMatch) {
    const outputText = document.getElementById('outputText');
    outputText.value = '处理中...';

    const inputAll = document.getElementById('inputText').value;
    const keywords = document.getElementById('keywords').value;

    document.getElementById('outputText').value = queryFunction(inputAll, keywords, selectMatch);
}

function copyOutput() {
    const outputText = document.getElementById('outputText');
    outputText.select();
    document.execCommand('copy');
}

function clearInputAndOutput() {
    const outputText = document.getElementById('outputText');
    outputText.value = '';

    const inputText = document.getElementById('inputText');
    inputText.value = '';
}

// 挑选关键词
function queryFunction(input, keywords, selectMatch) {

    let lines = input.split(/\r?\n/);
    keywords = keywords.split(/\r?\n/);

    let result = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        let regexString = keywords.filter(keyword => keyword !== "").map(keyword => escapeRegExp(keyword)).join('|');

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

