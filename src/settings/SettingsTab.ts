import { App, PluginSettingTab, Setting, ButtonComponent, TextComponent } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';

export class SettingsTab extends PluginSettingTab {
    plugin: SkribePlugin;
    quipInputEl: TextComponent;
    quipsListEl: HTMLElement;

    constructor(app: App, plugin: SkribePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        // General settings
        containerEl.createEl('h3', {text: 'General Settings'});

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

        // OpenAI integration
        containerEl.createEl('h3', {text: 'OpenAI Integration'});

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
            
        // Quips Section with more visible header
        const quipsHeader = containerEl.createEl('h3', {text: 'Quick Chat Messages (Quips)'});
        quipsHeader.style.marginTop = '2em';
        quipsHeader.style.borderTop = '1px solid var(--background-modifier-border)';
        quipsHeader.style.paddingTop = '1em';
        
        const quipsDesc = containerEl.createEl('p', {
            text: 'Add, edit, or remove quick chat messages that will appear as cards in the chat tab. Click a card to use that message in a chat.',
            cls: 'setting-item-description'
        });
        
        // Add new quip section
        const quipSetting = new Setting(containerEl)
            .setName('Add New Quip')
            .setDesc('Enter a quick chat message (1-50 words)')
            
        this.quipInputEl = new TextComponent(quipSetting.controlEl);
        this.quipInputEl
            .setPlaceholder('Enter a quick chat message...')
            .onChange(() => {
                const quipText = this.quipInputEl.getValue().trim();
                const wordCount = quipText.split(/\s+/).filter(word => word.length > 0).length;
                addButton.setDisabled(quipText.length === 0 || wordCount > 50);
            });
            
        const addButton = new ButtonComponent(quipSetting.controlEl)
            .setButtonText('Add')
            .setDisabled(true)
            .onClick(async () => {
                const quipText = this.quipInputEl.getValue().trim();
                const wordCount = quipText.split(/\s+/).filter(word => word.length > 0).length;
                
                if (quipText.length > 0 && wordCount <= 50) {
                    this.plugin.settings.quips.push(quipText);
                    await this.plugin.saveSettings();
                    this.quipInputEl.setValue('');
                    addButton.setDisabled(true);
                    this.displayQuipsList();
                }
            });
            
        // Create a dedicated element for the quips list
        this.quipsListEl = containerEl.createEl('div', {
            cls: 'quips-list-container'
        });
        
        // Display existing quips
        this.displayQuipsList();
    }
    
    displayQuipsList() {
        // Clear existing quips list
        this.quipsListEl.empty();
        
        // Create a heading for existing quips if there are any
        if (this.plugin.settings.quips.length > 0) {
            this.quipsListEl.createEl('h4', {
                text: 'Your Quips',
                cls: 'quips-subheading'
            });
        }
        
        if (this.plugin.settings.quips.length === 0) {
            this.quipsListEl.createEl('p', {
                text: 'No quips added yet.',
                cls: 'no-quips-message'
            });
            return;
        }
        
        const quipsList = this.quipsListEl.createEl('div', {
            cls: 'quips-list'
        });
        
        this.plugin.settings.quips.forEach((quip, index) => {
            const quipItem = quipsList.createEl('div', {
                cls: 'quip-item setting-item'
            });
            
            const quipText = quipItem.createEl('div', {
                text: quip,
                cls: 'quip-text setting-item-info'
            });
            
            const controls = quipItem.createEl('div', {
                cls: 'quip-controls setting-item-control'
            });
            
            new ButtonComponent(controls)
                .setIcon('pencil')
                .setTooltip('Edit')
                .onClick(() => {
                    // Replace quip item with an edit field
                    quipItem.empty();
                    
                    const editContainer = quipItem.createEl('div', {
                        cls: 'quip-edit-container'
                    });
                    
                    const editInput = new TextComponent(editContainer)
                        .setValue(quip)
                        .setPlaceholder('Enter a quick chat message...');
                    
                    const buttonContainer = quipItem.createEl('div', {
                        cls: 'quip-button-container'
                    });
                    
                    new ButtonComponent(buttonContainer)
                        .setButtonText('Save')
                        .onClick(async () => {
                            const newQuip = editInput.getValue().trim();
                            const wordCount = newQuip.split(/\s+/).filter(word => word.length > 0).length;
                            
                            if (newQuip.length > 0 && wordCount <= 50) {
                                this.plugin.settings.quips[index] = newQuip;
                                await this.plugin.saveSettings();
                                this.displayQuipsList();
                            }
                        });
                    
                    new ButtonComponent(buttonContainer)
                        .setButtonText('Cancel')
                        .onClick(() => {
                            this.displayQuipsList();
                        });
                });
            
            new ButtonComponent(controls)
                .setIcon('trash')
                .setTooltip('Delete')
                .onClick(async () => {
                    this.plugin.settings.quips.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.displayQuipsList();
                });
        });
    }
} 