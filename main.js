/*
THIS IS A GENERATED/BUNDLED FILE BY ROLLUP
if you want to view the source visit the plugins github repository
*/

'use strict';

var obsidian = require('obsidian');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

const DEFAULT_SETTINGS = {
    appendLink: true,
    filterWords: 'the,and,but,not,then,they,will,not,your,from,them,was,with,what,who,why,where,this,over,than',
    excluded: 'resource;Day Planners;',
    minLetters: 3,
};
class RelatedNotesPlugin extends obsidian.Plugin {
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('loading Link Master');
            yield this.loadSettings();
            const getPossibleLinks = () => __awaiter(this, void 0, void 0, function* () {
                // STEP1.获取设置
                const minLetters = this.settings.minLetters;
                const filterWords = this.settings.filterWords;
                const excluded = this.settings.excluded;
                // STEP2.获取当前页面文件名
                let activeView = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                if (!activeView)
                    return null;
                let activeFile = activeView.file;
                let activeFileName = activeView.file.basename;
                // STEP3.获取当前页面文件内外链接
                let relatedFile = [];
                let links = this.app.metadataCache.getFileCache(activeFile).links;
                if (!links)
                    links = [];
                links.forEach(link => {
                    relatedFile.push(link.link.split('#')[0]);
                });
                // 调用官方核心插件-外链
                //todo 取消引用外链插件
                // @ts-ignore
                let linksOut = this.app.metadataCache.getBacklinksForFile(activeFile).data;
                if (!linksOut)
                    linksOut = {};
                for (let fileName in linksOut) {
                    relatedFile.push(fileName.split('/').last().replace(/\.\w*$/, ''));
                }
                // 获取当前页面选取信息,替换文件标题 该功能废弃
                // const selectedRange = activeView.editor.getSelection();
                // activeFileName = selectedRange || activeFileName.replace(/[\W]+/g, " ");
                //
                // if (activeFileName.indexOf(' ') > -1) {
                //     activeFileName = activeFileName.split(' ')[1];
                // }
                // STEP4.获取vault中所有文件信息
                let files = this.app.vault.getFiles();
                let conceptFiles = [];
                for (let i in files) {
                    let isExcluded = false;
                    if (excluded !== '') {
                        isExcluded = excluded.split(';').filter(t => t)
                            .some(path => {
                            console.log(path, files[i].path, files[i].path.indexOf(path) > -1);
                            return files[i].path.indexOf(path) > -1;
                        });
                    }
                    if ((!isExcluded) //排除配置中忽略的文件夹
                        && files[i].extension == "md" //只匹配markdown文件
                        && files[i].basename !== activeView.file.basename //排除本身文件
                        && relatedFile.indexOf(files[i].basename) == -1 //排除已链接文件
                    ) {
                        let fileData = yield this.app.vault.cachedRead(files[i]);
                        let newFile = files[i];
                        newFile.fileData = fileData;
                        conceptFiles.push(newFile);
                    }
                }
                // STEP6.获取检索范围文件的全文关键词
                function getWords(fileData) {
                    let fileTextItems = fileData
                        .split(/(?<!-)(?!-)\b/); //切分单词
                    fileTextItems = [...new Set(fileTextItems)];
                    fileTextItems = fileTextItems
                        .map(text => {
                        return text.replace(/[\s]+/g, ""); //替换空白字符
                    })
                        .filter(t => {
                        return t.length >= minLetters //剔除不符合配置最小字符数
                            && filterWords.toLowerCase().split(",").indexOf(t.toLowerCase()) == -1 //剔除配置忽略字符
                            && !/^\W*$/.test(t); //剔除全是非字符的
                    });
                    return fileTextItems;
                }
                conceptFiles.forEach((file) => {
                    let fileData = file.fileData;
                    file.words = getWords(fileData);
                });
                // STEP7.将文件名与匹配检索范围文件内关键词匹配
                let keywords = {};
                // 智能处理奇怪的文件名
                // 带'.'的取其最长的部分
                activeFileName = activeFileName.indexOf('.') > -1 ? activeFileName.split('.').reduce((a, b) => a.length > b.length ? a : b) : activeFileName;
                // 带'#'的,带'&',带'_'的替换成'-'
                activeFileName = activeFileName.replace(/[#_&]/g, '-');
                conceptFiles.forEach(file => {
                    file.words.some(word => {
                        if (word.toLowerCase().indexOf(activeFileName.toLowerCase()) > -1 // 双向模糊匹配
                            || activeFileName.toLowerCase().indexOf(word.toLowerCase()) > -1) {
                            if (keywords[word] === undefined) {
                                keywords[word] = [];
                            }
                            keywords[word].push(file);
                            return true;
                        }
                        else {
                            return false;
                        }
                    });
                });
                // 全局搜索该文件名 废弃该功能
                // @ts-ignore
                // const globalSearchFn = this.app.internalPlugins.getPluginById('global-search').instance.openGlobalSearch.bind(this)
                // const search = (query: string) => globalSearchFn(inlineLog(query))
                // const searchLeaf = this.app.workspace.getLeavesOfType('search')[0]
                // await searchLeaf.open(searchLeaf.view)
                // search(activeFileName + ' ' + '-file:' + this.app.workspace.getActiveFile().basename);
                new KeywordsModal(this.app, keywords, this.app.workspace.getActiveFile().basename, this.settings).open();
            });
            this.addCommand({
                id: 'show-possible-links',
                name: 'Show Possible Links',
                callback: getPossibleLinks,
                hotkeys: [
                    {
                        modifiers: ["Mod"],
                        key: "6"
                    }
                ]
            });
            this.addCommand({
                id: 'toggle-Add-link',
                name: 'Toggle Add Link Feature',
                callback: () => {
                    this.settings.appendLink = !this.settings.appendLink;
                    this.saveSettings();
                    let status = this.settings.appendLink ? 'On' : 'Off';
                    new obsidian.Notice(`Add Link Feature is now ${status}`);
                }
            });
            this.addSettingTab(new RelatedNotesSettingTab(this.app, this));
        });
    }
    onunload() {
        console.log('unloading plugin');
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }
}
class KeywordsModal extends obsidian.Modal {
    constructor(app, keywords, filename, settings) {
        super(app);
        this.keywords = keywords;
        this.filename = filename;
        this.settings = settings;
    }
    onOpen() {
        let { contentEl } = this;
        let modalContainer = contentEl.createDiv();
        let keys = Object.keys(this.keywords);
        let length = 0;
        keys.forEach(key => {
            length += this.keywords[key].length;
        });
        modalContainer.createEl("h3", {
            text: `${this.filename}: ${length} recommended link`
        });
        let section = modalContainer.createDiv({ cls: 'possible-links-container' });
        keys.sort((a, b) => b.length - a.length);
        keys.map(keyword => {
            let noteContainer = section.createEl("p");
            noteContainer.createEl("p", {
                text: `${keyword}`
            });
            this.keywords[keyword].sort((a, b) => b.path.length - a.path.length);
            this.keywords[keyword].map((file) => {
                let line = noteContainer.createEl("p");
                let noteLink = line.createEl("a", {
                    text: file.path,
                    cls: 'possible-link-item'
                });
                noteLink.addEventListener('click', (e) => __awaiter(this, void 0, void 0, function* () {
                    let newLeaf = this.app.workspace.splitActiveLeaf('vertical');
                    yield newLeaf.openFile(file);
                }));
                if (Math.abs(keyword.length - this.filename.length) < 2 && this.settings.appendLink) {
                    let modify = line.createEl("a", {
                        text: 'Add Link',
                        cls: 'Add-Link-Button'
                    });
                    modify.addEventListener('click', (e) => __awaiter(this, void 0, void 0, function* () {
                        let fileData = yield this.app.vault.read(file);
                        let regKeyword = new RegExp(`(\\b)${keyword}(\\b)`, 'g');
                        console.log(regKeyword);
                        //todo 不影响标题、不影响frontmatter、不影响标签、不影响code
                        yield this.app.vault.modify(file, fileData.replace(regKeyword, '[[' + this.filename + '|' + keyword + ']]'));
                        new obsidian.Notice(`Added link [[${file.basename}]] to end of '${file.basename}'`);
                        modify.remove();
                    }));
                }
            });
        });
    }
    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}
class RelatedNotesSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Settings for Link Master' });
        // Possible Links
        containerEl.createEl('h3', { text: 'Find Files related to Current File' });
        new obsidian.Setting(containerEl)
            .setName('Link Add')
            .setDesc('This feature offer you a button to automatically add link to the matched file. Try it!')
            .addToggle(value => {
            value
                .setValue(this.plugin.settings.appendLink)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.appendLink = value;
                yield this.plugin.saveSettings();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName('Minimum Letters')
            .setDesc('Minimum letter count for a word when searching.')
            .addText(text => text
            .setPlaceholder('3')
            .setValue(this.plugin.settings.minLetters.toString())
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            this.plugin.settings.minLetters = parseInt(value);
            yield this.plugin.saveSettings();
        })));
        new obsidian.Setting(containerEl)
            .setName('Ignore File Path')
            .setDesc('Specify folder of Daily Journal to ignore these notes when searching for possible links. (leave blank to include dailies in possible links)')
            .addTextArea(text => {
            text
                .setPlaceholder('resource;Day Planners;')
                .setValue(this.plugin.settings.excluded)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.excluded = value;
                yield this.plugin.saveSettings();
            }));
            text.inputEl.rows = 3;
            text.inputEl.cols = 25;
        });
        new obsidian.Setting(containerEl)
            .setName('Filtered Words')
            .setDesc('Words filtered when searching for related notes. (separated by comma, no spaces)')
            .addTextArea(text => {
            text
                .setPlaceholder('and,but,they...')
                .setValue(this.plugin.settings.filterWords)
                .onChange((value) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.filterWords = value;
                yield this.plugin.saveSettings();
            }));
            text.inputEl.rows = 7;
            text.inputEl.cols = 25;
        });
    }
}

module.exports = RelatedNotesPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIm1haW4udHMiXSwic291cmNlc0NvbnRlbnQiOm51bGwsIm5hbWVzIjpbIlBsdWdpbiIsIk1hcmtkb3duVmlldyIsIk5vdGljZSIsIk1vZGFsIiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUF1REE7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ25HLFFBQVEsU0FBUyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxD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