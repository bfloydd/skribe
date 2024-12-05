import { App, PluginSettingTab, Setting } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';

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
            .setName('Transcript Folder')
            .setDesc('Folder to save transcripts (will be created if it doesn\'t exist)')
            .addText(text => text
                .setPlaceholder('Transcripts')
                .setValue(this.plugin.settings.transcriptFolder)
                .onChange(async (value) => {
                    this.plugin.settings.transcriptFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('OpenAI API Key')
            .setDesc('API key for OpenAI services (required for text reformatting)')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.openaiApiKey)
                .onChange(async (value) => {
                    this.plugin.settings.openaiApiKey = value;
                    OpenAIService.getInstance().setApiKey(value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('OpenAI Voice')
            .setDesc('Select the voice to use for text-to-speech')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'alloy': 'Alloy',
                    'echo': 'Echo',
                    'fable': 'Fable',
                    'onyx': 'Onyx',
                    'nova': 'Nova',
                    'shimmer': 'Shimmer'
                })
                .setValue(this.plugin.settings.voice)
                .onChange(async (value) => {
                    this.plugin.settings.voice = value;
                    await this.plugin.saveSettings();
                })
            );
    }
} 