const { shell } = require('electron');

const menuTemplate = function (param) {

    const { mainWindow, openSettingsWindow } = param

    return [
        {
            label: '文件',
            submenu: [
                {
                    label: '设置',
                    click() {
                        openSettingsWindow();
                    }
                },
                {
                    label: '退出',
                    role: 'quit'
                }
            ]
        },
        {
            label: '编辑',
            submenu: [
                { role: 'cut', label: '剪切' },
                { role: 'copy', label: '复制' },
                { role: 'paste', label: '粘贴' },
                { role: 'delete', label: '删除' },
                { role: 'selectAll', label: '全选' }
            ]
        },
        {
            label: '功能',
            submenu: [
                {
                    label: '好友ID查询',
                    click: () => {
                        mainWindow.loadFile('src/pages/friend-ids/index.html');
                    }
                },
                {
                    label: 'ID比较工具',
                    click: () => {
                        mainWindow.loadFile('src/pages/id-compare/index.html');
                    }
                },
                {
                    label: '匹配中文名称',
                    click: () => {
                        mainWindow.loadFile('src/pages/chinese-names/index.html');
                    }
                },
                {
                    label: '关键词匹配工具',
                    click: () => {
                        mainWindow.loadFile('src/pages/keywords-select/index.html');
                    }
                }
            ]
        },
        {
            label: '帮助',
            submenu: [
                {
                    label: '使用说明',
                    click: () => {
                        shell.openExternal("https://docs.google.com/document/d/1ssxfJXgi2wnVs9peMa2u2pzwgSOHVZRQ4C7UBuNx7r4/edit");
                    }
                },
                {
                    label: '问题反馈',
                    click: () => {
                        shell.openExternal("https://docs.google.com/spreadsheets/d/1DSqhoY1uVN3Kq0x73e_BZz4EQ6Kte8b2tL7_YLKVDbo/edit?gid=1236144827");
                    }
                },
                {
                    label: '开发者工具',
                    click: () => {
                        mainWindow.webContents.openDevTools();
                    }
                }
            ]
        }
    ];
}

module.exports = {
    menuTemplate
}