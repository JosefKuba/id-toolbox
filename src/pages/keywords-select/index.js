const $ = require("jquery")

const firebaseUrl = 'https://id-toolbox-default-rtdb.europe-west1.firebasedatabase.app/keywrods.json';

let keywordsApi

async function fetchData(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

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

// 从 Google 表格加载关键词
$('#keywords-select').on('change', function () {

    let value = $(this).val();

    // 过滤 value 为空
    if (!value) {
        $("#keywords").val("")
        return;
    }

    $("#keywords").val("关键词加载中...")

    let googleApi = keywordsApi + "?type=" + value
    fetchData(googleApi).then(data => {
        let keywords = ""

        for (const i in data) {
            if (data[i]) {
                keywords += data[i] + "\n"
            }
        }

        $("#keywords").val(keywords)
    })
});

function performQuery() {
    var outputText = document.getElementById('outputText');
    outputText.value = '处理中...';

    var inputAll = document.getElementById('inputText').value;
    var keywords = document.getElementById('keywords').value;

    var result = queryFunction(inputAll, keywords);

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
function queryFunction(input, keywords) {

    let lines = input.split(/\r?\n/);
    keywords = keywords.split(/\r?\n/);

    let result = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        let regexString = keywords.filter(keyword => keyword != "").map(keyword => escapeRegExp(keyword)).join('|');

        let regex = new RegExp('(' + regexString + ')');

        if (!regex.test(line)) {
            continue;
        }

        result.push(line);
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

