import {App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile} from 'obsidian';

interface RelatedNotesPluginSettings {
    appendLink: boolean;
    filterWords: string;
    excluded: string;
    minLetters: number;
}

function inlineLog(str: string) {
    console.log(str)
    return str
}

const DEFAULT_SETTINGS: RelatedNotesPluginSettings = {
    appendLink: true,
    filterWords: 'the,and,but,not,then,they,will,not,your,from,them,was,with,what,who,why,where,this,over,than',
    excluded: 'resource;Day Planners;',
    minLetters: 3,
}

export default class RelatedNotesPlugin extends Plugin {
    settings: RelatedNotesPluginSettings;

    async onload() {
        console.log('loading Link Master');

        await this.loadSettings();

        const getPossibleLinks = async (): Promise<any> => {
            // STEP1.获取设置
            const minLetters = this.settings.minLetters;
            const filterWords = this.settings.filterWords;
            const excluded = this.settings.excluded;

            // STEP2.获取当前页面文件名
            let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) return null;
            let activeFile = activeView.file;
            let activeFileName = activeView.file.basename;

            // STEP3.获取当前页面文件内外链接
            let relatedFile: string[] = [];
            let links: any[] = this.app.metadataCache.getFileCache(activeFile).links;
            if (!links) links = [];
            links.forEach(link => {
                relatedFile.push(link.link.split('#')[0])
            })
            // 调用官方核心插件-外链
            //todo 取消引用外链插件
            // @ts-ignore
            let linksOut: {} = this.app.metadataCache.getBacklinksForFile(activeFile).data;
            if (!linksOut) linksOut = {};
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

            // STEP5.按条件筛选出检索范围
            class TFileNew extends TFile {
                fileData: string;
                words: string[] = [];
            }

            let conceptFiles: TFileNew[] = [];

            for (let i in files) {
                let isExcluded: boolean = false;
                if (excluded !== '') {
                    isExcluded = excluded.split(';').filter(t => t)
                        .some(path => {
                            console.log(path, files[i].path, files[i].path.indexOf(path) > -1);

                            return files[i].path.indexOf(path) > -1;
                        })
                }
                if ((!isExcluded) //排除配置中忽略的文件夹
                    && files[i].extension == "md" //只匹配markdown文件
                    && files[i].basename !== activeView.file.basename //排除本身文件
                    && relatedFile.indexOf(files[i].basename) == -1 //排除已链接文件
                ) {
                    let fileData = await this.app.vault.cachedRead(files[i]);
                    let newFile: TFileNew = <TFileNew>files[i];
                    newFile.fileData = fileData;
                    conceptFiles.push(newFile);
                }
            }

            // STEP6.获取检索范围文件的全文关键词
            function getWords(fileData: string) {
                let fileTextItems = fileData
                    .split(/(?<!-)(?!-)\b/); //切分单词
                fileTextItems = [...new Set(fileTextItems)];
                fileTextItems = fileTextItems
                    .map(text => {
                        return text.replace(/[\s]+/g, "") //替换空白字符
                    })
                    .filter(t => {
                        return t.length >= minLetters //剔除不符合配置最小字符数
                            && filterWords.toLowerCase().split(",").indexOf(t.toLowerCase()) == -1 //剔除配置忽略字符
                            && !/^\W*$/.test(t) //剔除全是非字符的
                    });
                return fileTextItems;
            }

            conceptFiles.forEach((file) => {
                let fileData = file.fileData;
                file.words = getWords(fileData);
            })


            // STEP7.将文件名与匹配检索范围文件内关键词匹配
            let keywords: any = {};
            // 智能处理奇怪的文件名
            // 带'.'的取其最长的部分
            activeFileName = activeFileName.indexOf('.') > -1 ? activeFileName.split('.').reduce((a, b) => a.length > b.length ? a : b) : activeFileName;
            // 带'#'的,带'&',带'_'的替换成'-'
            activeFileName = activeFileName.replace(/[#_&]/g, '-')
            conceptFiles.forEach(file => {
                file.words.some(word => {
                    if (word.toLowerCase().indexOf(activeFileName.toLowerCase()) > -1 // 双向模糊匹配
                        || activeFileName.toLowerCase().indexOf(word.toLowerCase()) > -1
                    ) {
                        if (keywords[word] === undefined) {
                            keywords[word] = [];
                        }
                        keywords[word].push(file);
                        return true;
                    } else {
                        return false;
                    }
                })
            })

            // 全局搜索该文件名 废弃该功能
            // @ts-ignore
            // const globalSearchFn = this.app.internalPlugins.getPluginById('global-search').instance.openGlobalSearch.bind(this)
            // const search = (query: string) => globalSearchFn(inlineLog(query))
            // const searchLeaf = this.app.workspace.getLeavesOfType('search')[0]
            // await searchLeaf.open(searchLeaf.view)
            // search(activeFileName + ' ' + '-file:' + this.app.workspace.getActiveFile().basename);

            new KeywordsModal(this.app, keywords, this.app.workspace.getActiveFile().basename, this.settings).open();
        }

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
                new Notice(`Add Link Feature is now ${status}`)
            }
        });

        this.addSettingTab(new RelatedNotesSettingTab(this.app, this));
    }

    onunload() {
        console.log('unloading plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class KeywordsModal extends Modal {
    constructor(app: App, public keywords: any, public filename: string, public settings: any) {
        super(app);
    }

    onOpen() {
        let {contentEl} = this;
        let modalContainer = contentEl.createDiv();
        let keys = Object.keys(this.keywords);
        let length = 0;
        keys.forEach(key => {
            length += this.keywords[key].length;
        })
        modalContainer.createEl("h3", {
            text: `${this.filename}: ${length} recommended link`
        });
        let section = modalContainer.createDiv({cls: 'possible-links-container'});
        keys.sort((a, b) => b.length - a.length);
        keys.map(keyword => {
            let noteContainer = section.createEl("p");
            noteContainer.createEl("p", {
                text: `${keyword}`
            });

            this.keywords[keyword].sort((a: any, b: any) => b.path.length - a.path.length);
            this.keywords[keyword].map((file: any) => {
                let line = noteContainer.createEl("p")
                let noteLink = line.createEl("a", {
                    text: file.path,
                    cls: 'possible-link-item'
                });
                noteLink.addEventListener('click', async (e) => {
                    let newLeaf = this.app.workspace.splitActiveLeaf('vertical');
                    await newLeaf.openFile(file);
                });
                if (Math.abs(keyword.length - this.filename.length) < 2 && this.settings.appendLink) {
                    let modify = line.createEl("a", {
                        text: 'Add Link',
                        cls: 'Add-Link-Button'
                    });
                    modify.addEventListener('click', async (e) => {
                        let fileData = await this.app.vault.read(file);
                        let regKeyword = new RegExp(`(\\b)${keyword}(\\b)`, 'g')
                        console.log(regKeyword);
                        //todo 不影响标题、不影响frontmatter、不影响标签、不影响code
                        await this.app.vault.modify(file, fileData.replace(regKeyword, '[[' + this.filename + '|' + keyword + ']]'));
                        new Notice(`Added link [[${file.basename}]] to end of '${file.basename}'`)
                        modify.remove();
                    });
                }
            });

        });
    }

    onClose() {
        let {contentEl} = this;
        contentEl.empty();
    }
}


class RelatedNotesSettingTab extends PluginSettingTab {
    plugin: RelatedNotesPlugin;

    constructor(app: App, plugin: RelatedNotesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        let {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'Settings for Link Master'});

        // Possible Links
        containerEl.createEl('h3', {text: 'Find Files related to Current File'});

        new Setting(containerEl)
            .setName('Link Add')
            .setDesc('This feature offer you a button to automatically add link to the matched file. Try it!')
            .addToggle(value => {
                value
                    .setValue(this.plugin.settings.appendLink)
                    .onChange(async (value) => {
                        this.plugin.settings.appendLink = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Minimum Letters')
            .setDesc('Minimum letter count for a word when searching.')
            .addText(text => text
                .setPlaceholder('3')
                .setValue(this.plugin.settings.minLetters.toString())
                .onChange(async (value) => {
                    this.plugin.settings.minLetters = parseInt(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Ignore File Path')
            .setDesc('Specify folder of Daily Journal to ignore these notes when searching for possible links. (leave blank to include dailies in possible links)')
            .addTextArea(text => {
                text
                    .setPlaceholder('resource;Day Planners;')
                    .setValue(this.plugin.settings.excluded)
                    .onChange(async (value) => {
                        this.plugin.settings.excluded = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 3;
                text.inputEl.cols = 25;
            });

        new Setting(containerEl)
            .setName('Filtered Words')
            .setDesc('Words filtered when searching for related notes. (separated by comma, no spaces)')
            .addTextArea(text => {
                text
                    .setPlaceholder('and,but,they...')
                    .setValue(this.plugin.settings.filterWords)
                    .onChange(async (value) => {
                        this.plugin.settings.filterWords = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 7;
                text.inputEl.cols = 25;
            });
    }
}
