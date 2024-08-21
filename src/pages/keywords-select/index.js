function performQuery() {
    var outputText = document.getElementById('outputText');
    outputText.value = '处理中...';

    var inputAll = document.getElementById('inputText').value;
    var inputRemove = document.getElementById('inputTextRemove').value;

    var result = queryFunction(inputAll, inputRemove);

    updateOutput(result);
}

function updateOutput(output) {
    document.getElementById('outputText').value = output;
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
    outputText.value = '';

    var inputText2 = document.getElementById('inputTextRemove');
    inputText2.value = '';
}

function queryFunction(inputAll, inputRemove) {

    let linesAll = inputAll.replace(/ +/g, '').split(/\r?\n/);
    let linesRemove = inputRemove.replace(/ +/g, '').split(/\r?\n/);

    let result = arrayDifference(linesAll, linesRemove);

    return result.join("\n");
}

function arrayDifference(arr1, arr2) {
    return arr1.filter(element => !arr2.includes(element));
}