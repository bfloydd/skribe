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
            .setName('Include Timestamp in Filename')
            .setDesc('Add date/time suffix to saved transcript filenames')
            .addToggle(toggle => toggle
                .setValue(Boolean(this.plugin.settings.includeTimestampInFilename))
                .onChange(async (value) => {
                    console.log('Toggle changed to:', value);
                    this.plugin.settings.includeTimestampInFilename = value === true;
                    await this.plugin.saveSettings();
                    console.log('After saving, setting is:', this.plugin.settings.includeTimestampInFilename);
                    console.log('Type is:', typeof this.plugin.settings.includeTimestampInFilename);
                }));

        new Setting(containerEl)
            .setName('Include Content Type in Filename')
            .setDesc('Add content type (transcript/revised/summary) suffix to filenames')
            .addToggle(toggle => toggle
                .setValue(Boolean(this.plugin.settings.includeContentTypeInFilename))
                .onChange(async (value) => {
                    console.log('Content type toggle changed to:', value);
                    this.plugin.settings.includeContentTypeInFilename = value === true;
                    await this.plugin.saveSettings();
                    console.log('After saving, includeContentTypeInFilename is:', this.plugin.settings.includeContentTypeInFilename);
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