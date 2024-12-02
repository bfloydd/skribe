import { App, PluginSettingTab, Setting } from 'obsidian';
import type SkribePlugin from '../../main';

export class SettingsTab extends PluginSettingTab {
    plugin: SkribePlugin;

    constructor(app: App, plugin: SkribePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('YouTube API Key')
            .setDesc('Enter your YouTube Data API key')
            .addText(text => text
                .setPlaceholder('Enter API key')
                .setValue(this.plugin.settings.youtubeApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.youtubeApiKey = value;
                    await this.plugin.saveSettings();
                }));
    }
} 