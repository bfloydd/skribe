import { ItemView, WorkspaceLeaf, setIcon, Notice, MarkdownRenderer } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';
import { AudioPlayer } from '../services/AudioPlayer';

export const VIEW_TYPE_TRANSCRIPTION = "transcription-view";

export class TranscriptionView extends ItemView {
    content: string;
    plugin: SkribePlugin;
    contentEl: HTMLElement;
    private audioPlayer: AudioPlayer | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: SkribePlugin) {
        super(leaf);
        this.plugin = plugin;
        this.content = '';
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
        
        container.addClass('skribe-plugin');

        const header = container.createDiv({
            cls: 'nav-header'
        });

        const titleContainer = header.createDiv({
            cls: 'view-header-title-container'
        });

        const titleEl = titleContainer.createEl('span', {
            cls: 'view-header-title'
        });
        titleEl.setText('Skribe');

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

        // Add new audio controls row after the main header
        const audioControls = container.createDiv({
            cls: 'nav-header audio-controls'
        });
        audioControls.style.display = 'none'; // Hide by default

        const audioButtonContainer = audioControls.createDiv({
            cls: 'nav-buttons-container'
        });

        // Stop button
        const stopButton = audioButtonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': 'Stop playback',
                'title': 'Stop playback'
            }
        });
        setIcon(stopButton, 'square');
        stopButton.addEventListener('click', () => {
            if (this.audioPlayer) {
                this.audioPlayer.stop();
                audioControls.style.display = 'none';
            }
        });

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
                if (!this.plugin.settings.openaiApiKey) {
                    new Notice('Please set your OpenAI API key in settings');
                    return;
                }

                if (!this.audioPlayer) {
                    this.audioPlayer = new AudioPlayer(
                        this.plugin.settings.openaiApiKey,
                        (isPlaying) => {
                            setIcon(playButton, isPlaying ? 'pause-circle' : 'play-circle');
                            audioControls.style.display = isPlaying ? 'flex' : 'none';
                        },
                        OpenAIService.getInstance()
                    );
                    await this.audioPlayer.playText(this.content);
                } else {
                    this.audioPlayer.togglePlayPause();
                }
            } catch (error) {
                console.error('Error:', error);
                new Notice('Failed to play audio');
                setIcon(playButton, 'play-circle');
                audioControls.style.display = 'none';
                this.audioPlayer = null;
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