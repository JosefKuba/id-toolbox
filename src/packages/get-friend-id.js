const { ipcMain } = require('electron');
const fs = require('fs-extra');
const path = require('path');
let { friendIdDir } = require("./const.js");

ipcMain.on('read-file', async (event, idContent) => {

    let ids = idContent.split(/\r?\n/);

    let idStr = "";
    for (let i = 0; i < ids.length; i++) {
        let id = ids[i].trim();

        // 过滤掉没有分隔符的行
        if (id.length === 0) {
            continue;
        }

        console.log(friendIdDir, id)

        let filePath = path.join(friendIdDir, id)

        try {
            let fileContent = fs.readFileSync(filePath, 'utf-8');
            if (fileContent) {
                idStr += fileContent + "\n";
            }
        } catch (err) {
            idStr = id + "\t不存在\n" + idStr
        }
    }

    // 去重
    let uniqueArr = [...new Set(idStr.split(/\r?\n/))];

    // 移除空
    uniqueArr = uniqueArr.filter(Boolean)

    let result;
    if (uniqueArr.length == 0) {
        result = "无结果"
    } else {
        result = uniqueArr.join("\n")
    }

    event.sender.send('file-content', result);
});
