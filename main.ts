import { Plugin, Notice, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { SkribeSettings, DEFAULT_SETTINGS } from './src/types';
import { YouTubeService } from './src/services/YouTubeService';
import { TranscriptionView, VIEW_TYPE_TRANSCRIPTION } from './src/views/TranscriptionView';
import { URLInputModal } from './src/ui/URLInputModal';
import { SettingsTab } from './src/settings/SettingsTab';

export default class SkribePlugin extends Plugin {
    settings: SkribeSettings;
    view: TranscriptionView;
    youtubeService: YouTubeService;

    async onload() {
        console.log('Loading Skribe plugin...');
        
        await this.loadSettings();
        this.youtubeService = YouTubeService.getInstance();

        this.registerCommands();
        this.initializeView();
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
    }

    private initializeView() {
        this.registerView(
            VIEW_TYPE_TRANSCRIPTION,
            (leaf: WorkspaceLeaf) => new TranscriptionView(leaf)
        );
    }

    private handleSelectionCommand() {
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

    private handlePromptCommand() {
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
        let leaf = workspace.getRightLeaf(false);
        if (!leaf) {
            leaf = workspace.getLeaf('split', 'vertical');
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
            view.setContent(transcript);
            new Notice('Transcript loaded successfully');
        } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Unknown error occurred');
            console.error('Skribe Transcript Error:', error);
        }
    }
} 