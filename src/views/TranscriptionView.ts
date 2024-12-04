import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import type SkribePlugin from '../../main';

export const VIEW_TYPE_TRANSCRIPTION = "transcription-view";

export class TranscriptionView extends ItemView {
    content: string;
    plugin: SkribePlugin;

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
        
        // Create header with buttons
        const header = container.createDiv({
            cls: 'nav-header'
        });

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
            await navigator.clipboard.writeText(this.formatTranscript());
            new Notice('Transcript copied to clipboard');
        });

        // Save button
        const saveButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 'aria-label': 'Save transcript' }
        });
        setIcon(saveButton, 'save');
        saveButton.addEventListener('click', () => this.saveTranscript());

        // Create content container with padding
        const contentContainer = container.createDiv({
            cls: 'nav-folder-content'
        });

        // Add a styled container for the transcript
        const transcriptContainer = contentContainer.createDiv({
            cls: 'markdown-preview-view markdown-rendered'
        });

        // Split the content into paragraphs and create styled elements
        const paragraphs = this.content.split('. ');
        paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
                transcriptContainer.createEl('p', {
                    text: paragraph.trim() + '.',
                    cls: 'transcript-paragraph'
                });
            }
        });
    }

    private formatTranscript(): string {
        const formattedContent = this.content
            .split('. ')
            .filter(p => p.trim())
            .map(p => p.trim() + '.')
            .join('\n\n');

        return [
            '---',
            'type: transcript',
            `created: ${new Date().toISOString()}`,
            '---',
            '',
            '# Video Transcript',
            '',
            formattedContent
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
} 