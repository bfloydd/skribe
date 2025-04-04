import { Plugin, Notice, MarkdownView, WorkspaceLeaf, setIcon } from 'obsidian';
import { SkribeSettings, DEFAULT_SETTINGS } from './src/types/index';
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
        
        // Check for existing views that might need state restored
        this.app.workspace.onLayoutReady(() => {
            const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SKRIBE);
            if (existingLeaves.length > 0) {
                // Store view reference for any existing views
                for (const leaf of existingLeaves) {
                    if (leaf.view instanceof SkribeView) {
                        this.view = leaf.view;
                        // View's onOpen will handle state restoration
                        console.log('Found existing SkribeView on layout ready');
                    }
                }
            }
        });
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
        try {
            // Load data from disk
            const data = await this.loadData();
            console.log('Raw data loaded:', JSON.stringify(data));
            
            // Apply defaults
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
            
            // Handle boolean conversion explicitly
            if ('includeTimestampInFilename' in data) {
                // Use the exact value from the data file
                const rawValue = data.includeTimestampInFilename;
                console.log('Raw value from data file:', rawValue, 'of type', typeof rawValue);
                
                // Store as strict boolean (only true if it's exactly true)
                this.settings.includeTimestampInFilename = rawValue === true;
            }
            
            // Log the final settings
            console.log('Final loaded settings:', JSON.stringify(this.settings));
            console.log('includeTimestampInFilename is now:', this.settings.includeTimestampInFilename);
            console.log('Type is:', typeof this.settings.includeTimestampInFilename);
        } catch (error) {
            console.error('Error loading settings:', error);
            // Fall back to defaults on error
            this.settings = Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    async saveSettings() {
        try {
            await this.saveData(this.settings);
            console.log('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            new Notice('Failed to save Skribe settings');
        }
    }

    private async activateView() {
        const { workspace } = this.app;
        
        // Try to find existing SkribeView
        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_SKRIBE);
        let leaf: WorkspaceLeaf | null = null;
        let viewExists = false;
        
        // Check if we already have a SkribeView open anywhere
        if (existingLeaves.length > 0) {
            leaf = existingLeaves[0];
            viewExists = true;
            
            // If it's not in the right sidebar, close it
            if (leaf.getRoot() !== workspace.rightSplit) {
                // Close this instance since it's not in the right sidebar
                leaf.detach();
                leaf = null;
                viewExists = false;
            }
        }
        
        // If no view exists or it wasn't in the right sidebar, create a new one
        if (!leaf) {
            // Make sure right sidebar is open
            if (workspace.rightSplit.collapsed) {
                workspace.rightSplit.expand();
            }
            
            // Create a new leaf in the right sidebar
            leaf = workspace.getRightLeaf(false);
            
            // If we failed to get a leaf, create one at any location
            if (!leaf) {
                leaf = workspace.getLeaf();
            }
        }
        
        // At this point leaf should never be null
        if (!leaf) {
            new Notice('Failed to create a leaf for Skribe view');
            return null;
        }
        
        // Reveal the leaf
        workspace.revealLeaf(leaf);
        
        // Set the view state
        await leaf.setViewState({
            type: VIEW_TYPE_SKRIBE,
            active: true,
        });

        // Store the view reference
        if (leaf.view instanceof SkribeView) {
            this.view = leaf.view;
            
            // Try to load saved state, but only show notice for new views
            const hasState = this.view.loadSavedState();
            if (hasState && !viewExists) {
                new Notice('Restored previous Skribe session');
            }
            
            return this.view;
        }
        
        // If view creation failed, show an error
        new Notice('Failed to open Skribe view');
        return null;
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
            if (view) {
                view.setContent(transcript, url, title);
            } else {
                new Notice('Failed to open Skribe view');
            }
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
            console.log('Generated filename:', fileName);
            const wikilink = `[[${fileName}]]`;
            markdownView.editor.replaceSelection(wikilink);
            
            new Notice('Transcript saved and link inserted');
        } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Unknown error occurred');
            console.error('Skribe Transcript Error:', error);
        }
    }

    private async saveTranscriptToFile(content: string, title?: string): Promise<string> {
        // Force reload settings to ensure we have the latest values
        await this.loadSettings();
        
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

        // Log current settings state
        console.log('Settings object:', JSON.stringify(this.settings));
        console.log('includeTimestampInFilename setting:', this.settings.includeTimestampInFilename);
        console.log('Type of setting:', typeof this.settings.includeTimestampInFilename);
        
        // Always use strict boolean comparison
        const useTimestamp = this.settings.includeTimestampInFilename === true;
        console.log('Should use timestamp?', useTimestamp);
        
        // Generate clean title for filename
        const safeTitle = title ? title.replace(/[\\/:*?"<>|]/g, '-').substring(0, 30) : 'untitled';
        
        // Create filename based on settings
        let filename = '';
        if (useTimestamp) {
            // Format: transcript-Title-timestamp.md (with timestamp)
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            }).replace(':', '-');
            const timestamp = `${dateStr}-${timeStr}`;
            
            // Determine if we should include content type suffix
            if (this.settings.includeContentTypeInFilename === true) {
                filename = `${folderPath}/transcript-${safeTitle}-${timestamp}.md`;
            } else {
                filename = `${folderPath}/${safeTitle}-${timestamp}.md`;
            }
            console.log('Using timestamp in filename');
        } else {
            // Format without timestamp
            // Determine if we should include content type suffix
            if (this.settings.includeContentTypeInFilename === true) {
                filename = `${folderPath}/transcript-${safeTitle}.md`;
            } else {
                filename = `${folderPath}/${safeTitle}.md`;
            }
            console.log('Not using timestamp in filename');
        }
        
        console.log('Final filename that will be created:', filename);

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

        try {
            // Use the helper method to create the file with a unique name
            return await this.createFileWithUniqueName(filename, fileContent, true);
        } catch (error) {
            console.error('Error creating file:', error);
            throw error;
        }
    }

    private initializeRibbonIcon() {
        this.addRibbonIcon('feather', 'Skribe', (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();
            this.activateView();
        });
    }

    // Helper method to safely create a file with a unique name
    public async createFileWithUniqueName(initialPath: string, content: string, openAfterCreate: boolean = true): Promise<string> {
        // Normalize the path
        const normalizedPath = initialPath.replace(/\\/g, '/');
        
        try {
            // Check if file already exists
            let fileExists = false;
            try {
                fileExists = await this.app.vault.adapter.exists(normalizedPath);
            } catch (e) {
                console.log('Error checking if file exists:', e);
                // Assume it might exist if we can't check
                fileExists = true;
            }
            
            let finalPath = normalizedPath;
            
            // If file exists, add numbered suffix in parentheses
            if (fileExists) {
                let counter = 1;
                let newPath = '';
                
                do {
                    // Remove the .md extension for adding the suffix
                    const basePath = normalizedPath.replace(/\.md$/, '');
                    newPath = `${basePath} (${counter}).md`;
                    counter++;
                    
                    try {
                        fileExists = await this.app.vault.adapter.exists(newPath);
                    } catch (e) {
                        console.log('Error checking if numbered file exists:', e);
                        fileExists = true; // Try the next number
                    }
                } while (fileExists);
                
                finalPath = newPath;
            }
            
            // Final safety check before creating
            try {
                const finalExists = await this.app.vault.adapter.exists(finalPath);
                if (finalExists) {
                    // As a last resort, add a timestamp to ensure uniqueness
                    const uniqueTimestamp = Date.now();
                    const basePath = finalPath.replace(/\.md$/, '');
                    finalPath = `${basePath}-${uniqueTimestamp}.md`;
                }
            } catch (e) {
                console.log('Error in final existence check:', e);
                // Continue with current path
            }
            
            // Create the file
            const file = await this.app.vault.create(finalPath, content);
            
            // Open the file if requested
            if (openAfterCreate) {
                await this.app.workspace.getLeaf(false).openFile(file);
            }
            
            return file.path;
        } catch (error) {
            console.error('Error creating file:', error);
            throw error;
        }
    }

    async onunload() {
        console.log('Unloading Skribe plugin...');
        
        // Save current state if the view is active
        if (this.view) {
            // We don't need to call view.saveState() directly as it's already in the settings
            await this.saveSettings();
        }
    }
} 