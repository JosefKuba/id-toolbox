function performQuery() {
    const outputText = document.getElementById('outputText');
    outputText.value = '查询中...';

    const input = document.getElementById('inputText').value;
    const result = queryFunction(input);
    updateOutput(result)
}

function updateOutput(output) {
    document.getElementById('outputText').value = output;
}

function copyOutput() {
    const outputText = document.getElementById('outputText');
    outputText.select();
    document.execCommand('copy');
}

function copyOutputID() {
    let outputText = document.getElementById('outputText').value;
    let outputLines = outputText.split(/\r?\n/);

    let idStr = "";
    for (let i = 0; i < outputLines.length; i++) {
        let line = outputLines[i];

        // 过滤掉没有分隔符的行
        if (line.indexOf("\t") === -1) {
            continue;
        }

        let lineArr = line.split("\t");
        let id = lineArr[0];
        let country = lineArr[2];

        if (country === '保加利亚') {
            idStr += id + "\n";
        }
    }

    navigator.clipboard.writeText(idStr).then(function () {
        document.getElementById('outputText').select();
    });
}

function clearOutput() {
    const outputText = document.getElementById('outputText');
    outputText.value = '';
}

function clearInputAndOutput() {
    const outputText = document.getElementById('outputText');
    outputText.value = '';

    const inputText = document.getElementById('inputText');
    inputText.value = '';
}


const bulgarianSuffixes = ["ov", "ova", "ev", "eva", "ski", "ska", "in", "ina"];
const serbianSuffixes = ["ić", "ović"];
const macedonianSuffixes = ["ski", "ska", "ovski", "ovska"];
const turkishChars = ["ş", "ç", "ü", "ö", "ı", "ğ"];
const greekSuffixes = ["idis", "poulos", "theodor", "maratheftis"];
const cyrillicPattern = /[А-Яа-яЁё]/u;
const greekLettersPattern = /[Α-Ωα-ω]/u;

function queryFunction(input) {

    let lines = input.split(/\r?\n/);

    let right = [], rightId = [], notSure = [], error = [];

    for (let line of lines) {
        let lineArr = line.split('\t');
        let id = lineArr[0];
        let name = lineArr[1]?.toLowerCase();

        if (!id || !name) continue;

        let country = checkName(name);

        switch (country) {
            case '保加利亚':
            case '马其顿':
                right.push(`${line}\t${country}`);
                rightId.push(id);
                break;
            case '不确定':
                notSure.push(line + '\t不确定国家');
                break;
            default:
                error.push(`${line}\t${country}`);
                break;
        }
    }

    return right.join("\n") + "\n\n" + notSure.join("\n") + "\n\n" + error.join("\n");
}

function checkName(name) {
    let nameLower = name.toLowerCase();

    if (turkishChars.some(char => nameLower.includes(char))) {
        return '土耳其';
    }

    if (greekLettersPattern.test(name)) {
        return '希腊';
    }

    if (bulgarianSuffixes.some(suffix => nameLower.endsWith(suffix))) {
        return '保加利亚';
    }

    if (serbianSuffixes.some(suffix => nameLower.endsWith(suffix))) {
        return '塞尔维亚';
    }

    if (macedonianSuffixes.some(suffix => nameLower.endsWith(suffix))) {
        return '马其顿';
    }

    if (greekSuffixes.some(suffix => nameLower.endsWith(suffix))) {
        return '希腊';
    }

    if (cyrillicPattern.test(name)) {
        return '保加利亚';
    }

    return '不确定';
}