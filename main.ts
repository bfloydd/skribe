import { Plugin, Notice, MarkdownView, WorkspaceLeaf, Menu, Editor, setIcon } from 'obsidian';
import { SkribeSettings, DEFAULT_SETTINGS } from './src/types';
import { YouTubeService } from './src/services/YouTubeService';
import { OpenAIService } from './src/services/OpenAIService';
import { TranscriptionView, VIEW_TYPE_TRANSCRIPTION } from './src/views/TranscriptionView';
import { URLInputModal } from './src/ui/URLInputModal';
import { SettingsTab } from './src/settings/SettingsTab';
import { SkribeMenu } from './src/ui/SkribeMenu';

export default class SkribePlugin extends Plugin {
    settings: SkribeSettings;
    view: TranscriptionView;
    youtubeService: YouTubeService;
    openaiService: OpenAIService;

    async onload() {
        console.log('Loading Skribe plugin...');
        
        await this.loadSettings();
        this.youtubeService = YouTubeService.getInstance();
        this.openaiService = OpenAIService.getInstance();
        this.openaiService.setApiKey(this.settings.openaiApiKey);
        this.openaiService.setPlugin(this);

        this.registerCommands();
        this.initializeView();
        this.initializeMenu();
        this.addSettingTab(new SettingsTab(this.app, this));
    }

    private registerCommands() {
        this.addCommand({
            id: 'get-selected-transcript',
            name: 'Get Video Transcript by Selection',
            callback: () => this.handleSelectionCommand()
        });

        this.addCommand({
            id: 'prompt-youtube-url',
            name: 'Get Video Transcript by Prompt',
            callback: () => this.handlePromptCommand()
        });

        this.addCommand({
            id: 'replace-with-skribe-link',
            name: 'Replace selected URL with link to Skribe-note',
            callback: () => this.handleReplaceCommand()
        });
    }

    private initializeView() {
        this.registerView(
            VIEW_TYPE_TRANSCRIPTION,
            (leaf: WorkspaceLeaf) => new TranscriptionView(leaf, this)
        );
    }

    public handleSelectionCommand() {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!markdownView) {
            new Notice('Please open a markdown file first');
            return;
        }

        const selection = markdownView.editor.getSelection();
        if (!selection) {
            new Notice('Please select a YouTube URL first');
            return;
        }

        this.handleTranscriptRequest(selection);
    }

    public handlePromptCommand(providedUrl?: string) {
        if (providedUrl) {
            // If URL is provided directly, process it
            if (this.youtubeService.isYouTubeUrl(providedUrl)) {
                const videoId = this.youtubeService.extractVideoId(providedUrl);
                if (videoId) {
                    this.handleTranscriptRequest(providedUrl);
                } else {
                    new Notice('Could not extract video ID from the URL');
                }
            } else {
                new Notice('Invalid YouTube URL');
            }
            return;
        }

        // Otherwise, open the modal to get URL from user
        new URLInputModal(this.app, (url) => {
            if (this.youtubeService.isYouTubeUrl(url)) {
                const videoId = this.youtubeService.extractVideoId(url);
                if (videoId) {
                    this.handleTranscriptRequest(url);
                } else {
                    new Notice('Could not extract video ID from the URL');
                }
            } else {
                new Notice('Invalid YouTube URL');
            }
        }).open();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async activateView() {
        const { workspace } = this.app;
        
        // Try to find existing TranscriptionView
        let existingView = workspace.getLeavesOfType(VIEW_TYPE_TRANSCRIPTION)[0];
        let leaf: WorkspaceLeaf;

        if (existingView) {
            // Use existing leaf if view already exists
            leaf = existingView;
        } else {
            // Create new leaf if no view exists
            leaf = workspace.getRightLeaf(false) || workspace.getLeaf();
        }
        
        await leaf.setViewState({
            type: VIEW_TYPE_TRANSCRIPTION,
            active: true,
        });

        this.view = leaf.view as TranscriptionView;
        return this.view;
    }

    private async handleTranscriptRequest(url: string) {
        if (!this.youtubeService.isYouTubeUrl(url)) {
            new Notice('Invalid YouTube URL');
            return;
        }

        const videoId = this.youtubeService.extractVideoId(url);
        if (!videoId) {
            new Notice('Could not extract video ID from the URL');
            return;
        }

        new Notice('Fetching transcript...');
        try {
            const transcript = await this.youtubeService.getTranscript(videoId);
            const view = await this.activateView();
            view.setContent(transcript, url);
            new Notice('Transcript loaded successfully');
        } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Unknown error occurred');
            console.error('Skribe Transcript Error:', error);
        }
    }

    public async handleReplaceCommand() {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!markdownView) {
            new Notice('Please open a markdown file first');
            return;
        }

        const selection = markdownView.editor.getSelection();
        if (!selection) {
            new Notice('Please select a YouTube URL first');
            return;
        }

        if (!this.youtubeService.isYouTubeUrl(selection)) {
            new Notice('Invalid YouTube URL');
            return;
        }

        const videoId = this.youtubeService.extractVideoId(selection);
        if (!videoId) {
            new Notice('Could not extract video ID from the URL');
            return;
        }

        new Notice('Fetching transcript...');
        try {
            const transcript = await this.youtubeService.getTranscript(videoId);
            const filePath = await this.saveTranscriptToFile(transcript);
            
            // Replace the selection with a wikilink to the new file
            const fileName = filePath.split('/').pop();
            const wikilink = `[[${fileName}]]`;
            markdownView.editor.replaceSelection(wikilink);
            
            new Notice('Transcript saved and link inserted');
        } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Unknown error occurred');
            console.error('Skribe Transcript Error:', error);
        }
    }

    private async saveTranscriptToFile(content: string): Promise<string> {
        const folder = this.settings.transcriptFolder;
        const folderPath = folder.replace(/^\/+|\/+$/g, '');
        
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.createFolder(folderPath);
        }

        // Format content into paragraphs
        const formattedContent = content
            .split('. ')
            .filter(p => p.trim())
            .map(p => p.trim() + '.')
            .join('\n\n');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${folderPath}/transcript-${timestamp}.md`;

        // Add metadata at the top of the file
        const fileContent = [
            '---',
            'type: transcript',
            `created: ${new Date().toISOString()}`,
            '---',
            '',
            '# Video Transcript',
            '',
            formattedContent
        ].join('\n');

        await this.app.vault.create(filename, fileContent);
        return filename;
    }

    private initializeMenu() {
        const menu = new SkribeMenu(this);
        this.addRibbonIcon('feather', 'Skribe', (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            menu.toggle();
        });
    }
} 