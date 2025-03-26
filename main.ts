import { Plugin, Notice, MarkdownView, WorkspaceLeaf, Menu, Editor, setIcon } from 'obsidian';
import { SkribeSettings, DEFAULT_SETTINGS } from './src/types';
import { YouTubeService } from './src/services/YouTubeService';
import { OpenAIService } from './src/services/OpenAIService';
import { SkribeView, VIEW_TYPE_SKRIBE } from './src/views/SkribeView';
import { URLInputModal } from './src/ui/URLInputModal';
import { SettingsTab } from './src/settings/SettingsTab';
import { ToolbarService } from './src/services/ToolbarService';
import { CommonCommands } from './src/services/CommonCommands';
import { ToolbarConfigs } from './src/services/ToolbarConfigs';

export default class SkribePlugin extends Plugin {
    settings: SkribeSettings;
    view: SkribeView;
    youtubeService: YouTubeService;
    openaiService: OpenAIService;
    toolbarService: ToolbarService;

    async onload() {
        console.log('Loading Skribe plugin...');
        
        await this.loadSettings();
        this.youtubeService = YouTubeService.getInstance();
        this.openaiService = OpenAIService.getInstance();
        this.openaiService.setApiKey(this.settings.openaiApiKey);
        this.openaiService.setPlugin(this);
        
        // Initialize toolbar service
        this.toolbarService = ToolbarService.getInstance();
        this.initializeToolbars();

        this.registerCommands();
        this.initializeView();
        this.initializeRibbonIcon();
        this.addSettingTab(new SettingsTab(this.app, this));
    }

    private initializeToolbars() {
        // Register common commands
        this.toolbarService.registerCommonCommands(CommonCommands);
        
        // Register toolbar configurations
        ToolbarConfigs.forEach(config => {
            this.toolbarService.registerToolbarConfig(config);
        });
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

        this.addCommand({
            id: 'open-skribe',
            name: 'Skribe: Open',
            callback: () => this.activateView()
        });
    }

    private initializeView() {
        this.registerView(
            VIEW_TYPE_SKRIBE,
            (leaf: WorkspaceLeaf) => new SkribeView(leaf, this)
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
        
        // Try to find existing SkribeView
        let existingView = workspace.getLeavesOfType(VIEW_TYPE_SKRIBE)[0];
        let leaf: WorkspaceLeaf;

        if (existingView) {
            // Use existing leaf if view already exists
            leaf = existingView;
        } else {
            // Create a new leaf in the right sidebar
            let rightLeaf = this.app.workspace.getRightLeaf(false);
            
            // If we couldn't get a leaf in the right sidebar, try to create one
            if (!rightLeaf || rightLeaf.getViewState().type === 'empty') {
                // Open right sidebar if it's not already open
                if (this.app.workspace.rightSplit.collapsed) {
                    this.app.workspace.rightSplit.expand();
                }
                
                // Get or create a leaf in the right sidebar
                rightLeaf = this.app.workspace.getRightLeaf(true);
            }
            
            // Fallback to a generic leaf if we couldn't create one in the sidebar
            leaf = rightLeaf || workspace.getLeaf();
        }
        
        // Reveal the leaf in case it's in a collapsed sidebar
        workspace.revealLeaf(leaf);
        
        await leaf.setViewState({
            type: VIEW_TYPE_SKRIBE,
            active: true,
        });

        this.view = leaf.view as SkribeView;
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
            const { transcript, title } = await this.youtubeService.getTranscript(videoId);
            const view = await this.activateView();
            view.setContent(transcript, url, title);
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
            const { transcript, title } = await this.youtubeService.getTranscript(videoId);
            const filePath = await this.saveTranscriptToFile(transcript, title);
            
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

    private async saveTranscriptToFile(content: string, title?: string): Promise<string> {
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
        const safeTitle = title ? title.replace(/[\\/:*?"<>|]/g, '-').substring(0, 50) : '';
        const filename = `${folderPath}/transcript-${safeTitle ? safeTitle + '-' : ''}${timestamp}.md`;

        // Add metadata at the top of the file
        const fileContent = [
            '---',
            'type: transcript',
            `created: ${new Date().toISOString()}`,
            title ? `title: "${title}"` : '',
            '---',
            '',
            title ? `# ${title}` : '# Video Transcript',
            '',
            formattedContent
        ].filter(line => line !== '').join('\n');

        await this.app.vault.create(filename, fileContent);
        return filename;
    }

    private initializeRibbonIcon() {
        this.addRibbonIcon('feather', 'Skribe', (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            this.activateView();
        });
    }
} 