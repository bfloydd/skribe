import { ItemView, WorkspaceLeaf, setIcon, Notice, MarkdownRenderer, requestUrl } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';

export const VIEW_TYPE_TRANSCRIPTION = "transcription-view";

export class TranscriptionView extends ItemView {
    content: string;
    plugin: SkribePlugin;
    contentEl: HTMLElement;
    private audioElement: HTMLAudioElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: SkribePlugin) {
        super(leaf);
        this.plugin = plugin;
        this.content = '';
        this.audioElement = null;
    }
    
    getIcon() {
        return "feather";
    }

    getViewType() {
        return VIEW_TYPE_TRANSCRIPTION;
    }

    getDisplayText() {
        return "Video Transcription";
    }

    setContent(content: string) {
        this.content = content;
        this.refresh();
    }

    async onOpen() {
        this.refresh();
    }

    async refresh() {
        const container = this.containerEl.children[1];
        container.empty();
        
        // Add a class to scope styles
        container.addClass('skribe-plugin');

        // Create header with buttons
        const header = container.createDiv({
            cls: 'nav-header'
        });

        // Add title container for centering
        const titleContainer = header.createDiv({
            cls: 'view-header-title-container'
        });

        // Add title
        const titleEl = titleContainer.createEl('span', {
            cls: 'view-header-title'
        });
        titleEl.setText('Skribe');

        // Center container for buttons
        const buttonContainer = header.createDiv({
            cls: 'nav-buttons-container'
        });

        // Copy button
        const copyButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 'aria-label': 'Copy transcript' }
        });
        setIcon(copyButton, 'copy');
        copyButton.addEventListener('click', async () => {
            await navigator.clipboard.writeText(this.content);
            new Notice('Transcript copied to clipboard');
        });

        // Save button
        const saveButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 'aria-label': 'Save transcript' }
        });
        setIcon(saveButton, 'save');
        saveButton.addEventListener('click', () => this.saveTranscript());

        // Format button
        const formatButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': 'Enhance with AI (Format + Summary)',
                'title': 'Format transcript and add summary with key points'
            }
        });
        setIcon(formatButton, 'wand');
        formatButton.addEventListener('click', () => this.reformatWithAI());

        // Play button (OpenAI TTS)
        const playButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': 'Play/Pause transcript with TTS',
                'title': 'Play/Pause transcript using Text-to-Speech'
            }
        });
        setIcon(playButton, 'play-circle');
        playButton.addEventListener('click', async () => {
            try {
                // If audio exists, handle play/pause
                if (this.audioElement) {
                    if (this.audioElement.paused) {
                        await this.audioElement.play();
                        setIcon(playButton, 'pause-circle');
                    } else {
                        this.audioElement.pause();
                        setIcon(playButton, 'play-circle');
                    }
                    return;
                }

                if (!this.plugin.settings.openaiApiKey) {
                    new Notice('Please set your OpenAI API key in settings');
                    return;
                }

                new Notice('Generating audio...');
                const response = await requestUrl({
                    url: 'https://api.openai.com/v1/audio/speech',
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.plugin.settings.openaiApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'tts-1',
                        input: this.content.slice(0, 4096),
                        voice: 'alloy'
                    }),
                    throw: false
                });

                if (response.status !== 200) {
                    console.error('OpenAI API Error:', response.text);
                    throw new Error(`API Error: ${response.text}`);
                }

                const audioBlob = new Blob([response.arrayBuffer], { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(audioBlob);
                this.audioElement = new Audio(audioUrl);
                
                // Add ended event listener to reset button
                this.audioElement.addEventListener('ended', () => {
                    setIcon(playButton, 'play-circle');
                    this.audioElement = null;
                    URL.revokeObjectURL(audioUrl);
                });

                await this.audioElement.play();
                setIcon(playButton, 'pause-circle');
                new Notice('Playing audio...');
            } catch (error) {
                console.error('Error:', error);
                new Notice('Failed to generate audio');
                setIcon(playButton, 'play-circle');
                this.audioElement = null;
            }
        });

        // Create content container with padding
        const contentContainer = container.createDiv({
            cls: 'nav-folder-content markdown-preview-view'
        });

        // Create markdown content container
        const markdownContainer = contentContainer.createDiv();
        
        if (this.content) {
            await MarkdownRenderer.renderMarkdown(
                this.content,
                markdownContainer,
                this.app.workspace.getActiveFile()?.path || '',
                this
            );
        }
    }

    private formatTranscript(): string {
        return [
            '---',
            'type: transcript',
            `created: ${new Date().toISOString()}`,
            '---',
            '',
            this.content
        ].join('\n');
    }

    private async saveTranscript() {
        try {
            const folder = this.plugin.settings.transcriptFolder;
            const folderPath = folder.replace(/^\/+|\/+$/g, '');
            
            if (!(await this.app.vault.adapter.exists(folderPath))) {
                await this.app.vault.createFolder(folderPath);
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${folderPath}/transcript-${timestamp}.md`;

            await this.app.vault.create(filename, this.formatTranscript());
            new Notice(`Transcript saved to ${filename}`);
        } catch (error) {
            new Notice('Failed to save transcript: ' + error.message);
        }
    }

    private async reformatWithAI() {
        try {
            if (!this.plugin.settings.openaiApiKey) {
                new Notice('Please set your OpenAI API key in settings');
                return;
            }

            const loadingNotice = new Notice('Reformatting transcript...', 0);
            try {
                const openai = OpenAIService.getInstance();
                const reformattedText = await openai.reformatText(this.content);
                this.setContent(reformattedText);
                loadingNotice.hide();
                new Notice('Transcript reformatted successfully');
            } catch (error) {
                loadingNotice.hide();
                throw error;
            }
        } catch (error) {
            new Notice('Failed to reformat transcript: ' + error.message);
        }
    }
} 