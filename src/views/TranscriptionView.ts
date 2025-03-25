import { ItemView, WorkspaceLeaf, setIcon, Notice, MarkdownRenderer } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';
import { AudioPlayer } from '../services/AudioPlayer';
import { ChatMessage, ChatState, CommandContext } from '../types';

export const VIEW_TYPE_TRANSCRIPTION = "transcription-view";

export class TranscriptionView extends ItemView {
    content: string;
    plugin: SkribePlugin;
    contentEl: HTMLElement;
    private audioPlayer: AudioPlayer | null = null;
    private videoUrl: string = '';
    private chatState: ChatState = { messages: [] };
    private activeTab: 'transcript' | 'chat' | 'summary' = 'transcript';
    private transcriptContainer: HTMLElement;
    private chatContainer: HTMLElement;
    private summaryContainer: HTMLElement;
    private summaryContent: string = '';
    private welcomeMessages: string[] = [
        'Hello, Skribe!',
        'Hire a Skribe',
        'Skribe a Video'
    ];

    private getRandomWelcomeMessage(): string {
        const randomIndex = Math.floor(Math.random() * this.welcomeMessages.length);
        return this.welcomeMessages[randomIndex];
    }

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

    setContent(content: string, videoUrl?: string) {
        this.content = content;
        if (videoUrl) {
            this.videoUrl = videoUrl;
            this.chatState.videoUrl = videoUrl;
        }
        this.refresh();
    }

    async onOpen() {
        this.refresh();
    }

    async refresh() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        
        container.addClass('skribe-plugin');

        // Create header
        const header = this.createHeader(container);
        
        // If no video is selected, show a prompt message and return
        if (!this.content) {
            // Create a centered container for the empty state
            const centerContainer = container.createDiv({
                cls: 'empty-state-center-container'
            });
            
            const promptContainer = centerContainer.createDiv({
                cls: 'empty-state-container'
            });
            
            // Add logo image
            const logoContainer = promptContainer.createDiv({
                cls: 'empty-state-logo-container'
            });
            const logo = logoContainer.createEl('img', {
                cls: 'empty-state-logo',
                attr: {
                    src: this.app.vault.adapter.getResourcePath('.obsidian/plugins/skribe/logo.png'),
                    alt: 'Skribe Logo'
                }
            });
            logo.style.width = '128px';
            logo.style.height = 'auto';
            logo.style.marginBottom = '20px';
            
            // Get a new random message each time
            const message = this.getRandomWelcomeMessage();
            const promptMessage = promptContainer.createEl('div', {
                text: message,
                cls: 'empty-state-message'
            });
            
            // Create URL input container
            const inputContainer = promptContainer.createDiv({
                cls: 'empty-state-input-container'
            });
            inputContainer.style.display = 'flex';
            inputContainer.style.width = '100%';
            inputContainer.style.gap = '10px';
            
            // Create URL input
            const urlInput = inputContainer.createEl('input', {
                cls: 'empty-state-url-input',
                attr: {
                    type: 'text',
                    placeholder: 'Enter YouTube URL...'
                }
            });
            urlInput.style.flexGrow = '1';
            urlInput.style.padding = '8px 12px';
            urlInput.style.borderRadius = '4px';
            urlInput.style.border = '1px solid var(--background-modifier-border)';
            
            // Create get transcript button
            const getButton = inputContainer.createEl('button', {
                cls: 'empty-state-get-button',
                text: 'Go!'
            });
            getButton.style.padding = '8px 16px';
            getButton.style.borderRadius = '4px';
            getButton.style.backgroundColor = 'var(--interactive-accent)';
            getButton.style.color = 'var(--text-on-accent)';
            getButton.style.cursor = 'pointer';
            getButton.style.border = 'none';
            getButton.style.fontWeight = 'bold';
            
            // Handle get transcript button click
            const handleGetTranscript = () => {
                const url = urlInput.value.trim();
                if (!url) return;
                
                this.plugin.handlePromptCommand(url);
            };
            
            getButton.addEventListener('click', handleGetTranscript);
            urlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleGetTranscript();
                }
            });
            
            return;
        }
        
        // Create video URL display
        if (this.videoUrl) {
            this.createVideoUrlDisplay(container);
        }

        // Create tabs
        this.createTabs(container);

        // Create content containers
        const contentWrapper = container.createDiv({
            cls: 'skribe-content-wrapper'
        });

        // Create transcript container
        this.transcriptContainer = contentWrapper.createDiv({
            cls: 'nav-folder-content markdown-preview-view transcript-container'
        });
        this.transcriptContainer.style.overflowY = 'auto';
        this.transcriptContainer.style.display = this.activeTab === 'transcript' ? 'block' : 'none';

        // Create chat container
        this.chatContainer = contentWrapper.createDiv({
            cls: 'chat-container'
        });
        this.chatContainer.style.display = this.activeTab === 'chat' ? 'block' : 'none';
        
        // Create summary container
        this.summaryContainer = contentWrapper.createDiv({
            cls: 'summary-container markdown-preview-view'
        });
        this.summaryContainer.style.overflowY = 'auto';
        this.summaryContainer.style.display = this.activeTab === 'summary' ? 'block' : 'none';

        // Render transcript content
        if (this.content) {
            await this.renderTranscriptContent();
        }

        // Render chat interface
        this.renderChatInterface();
        
        // Render summary content if available
        if (this.summaryContent) {
            await this.renderSummaryContent();
        }
    }

    private createHeader(container: HTMLElement): HTMLElement {
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

        // Only show restart button if we have content
        if (this.content) {
            // Create restart button positioned on the right
            const restartButton = header.createEl('button', {
                cls: 'clickable-icon restart-button',
                attr: { 
                    'aria-label': 'Start over',
                    'title': 'Start over'
                }
            });
            
            // Position the button at the top right
            restartButton.style.position = 'absolute';
            restartButton.style.right = '10px';
            restartButton.style.top = '5px';
            restartButton.style.backgroundColor = 'var(--background-modifier-border)';
            restartButton.style.color = 'var(--text-normal)';
            restartButton.style.padding = '4px 8px';
            restartButton.style.borderRadius = '4px';
            restartButton.style.fontWeight = 'bold';
            restartButton.style.cursor = 'pointer';
            restartButton.style.zIndex = '100';
            
            setIcon(restartButton, 'rotate-ccw');
            
            // Add direct click handler
            restartButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Restart button clicked');
                
                try {
                    this.resetView();
                } catch (error) {
                    console.error('Error resetting view:', error);
                    new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });
        }

        return header;
    }

    private createVideoUrlDisplay(container: HTMLElement) {
        const urlContainer = container.createDiv({
            cls: 'video-url-container'
        });
        urlContainer.style.textAlign = 'center';
        urlContainer.style.padding = '5px';
        urlContainer.style.marginBottom = '10px';
        
        const urlLink = urlContainer.createEl('a', {
            text: this.videoUrl,
            href: this.videoUrl,
            cls: 'video-url-link'
        });
        urlLink.style.color = 'var(--text-accent)';
        urlLink.target = '_blank';
    }

    private createTabs(container: HTMLElement) {
        const tabsContainer = container.createDiv({
            cls: 'tabs-container'
        });

        // Transcript tab
        const transcriptTab = this.createTabItem(tabsContainer, 'Transcript', this.activeTab === 'transcript');
        
        // Chat tab
        const chatTab = this.createTabItem(tabsContainer, 'Chat', this.activeTab === 'chat');
        
        // Summary tab
        const summaryTab = this.createTabItem(tabsContainer, 'Summary', this.activeTab === 'summary');
        
        // Add click handlers
        chatTab.addEventListener('click', () => {
            this.switchToTab('chat');
            // Refresh the view to update toolbars
            this.refresh();
        });
        
        transcriptTab.addEventListener('click', () => {
            this.switchToTab('transcript');
            // Refresh the view to update toolbars
            this.refresh();
        });
        
        summaryTab.addEventListener('click', () => {
            this.switchToTab('summary');
            // Refresh the view to update toolbars
            this.refresh();
        });
    }
    
    private createTabItem(container: HTMLElement, text: string, isActive: boolean): HTMLElement {
        const tab = container.createDiv({
            cls: `tab-item ${isActive ? 'active' : ''}`,
            text: text
        });
        
        if (isActive) {
            tab.style.borderBottom = '2px solid var(--text-accent)';
            tab.style.fontWeight = 'bold';
        } else {
            tab.style.borderBottom = '2px solid transparent';
            tab.style.fontWeight = 'normal';
        }
        
        return tab;
    }

    private async renderTranscriptContent() {
        console.log('TranscriptionView: renderTranscriptContent called');
        
        // Create transcript toolbar container at the top
        const transcriptToolbarContainer = this.transcriptContainer.createDiv({
            cls: 'transcript-toolbar-container'
        });
        
        // Create toolbar with transcript commands but exclude the format-ai command
        const toolbarContext = {
            plugin: this.plugin,
            view: this,
            content: this.content,
            videoUrl: this.videoUrl,
            activeTab: this.activeTab
        };
        
        console.log('TranscriptionView: Creating transcript toolbar with context', {
            hasContent: !!toolbarContext.content,
            contentLength: toolbarContext.content?.length,
            hasPlugin: !!toolbarContext.plugin,
            hasApiKey: !!toolbarContext.plugin?.settings?.openaiApiKey,
            view: toolbarContext.view?.constructor.name
        });
        
        // Create transcript toolbar with all commands EXCEPT format-ai
        // We'll add our own direct button instead
        this.plugin.toolbarService.createToolbar(transcriptToolbarContainer, 'transcript', toolbarContext);
        
        // Add a direct enhance button that works reliably
        const directEnhanceButton = transcriptToolbarContainer.createEl('button', {
            cls: 'clickable-icon toolbar-button',
            attr: { 
                'aria-label': 'Enhance with AI',
                'title': 'Enhance with AI'
            }
        });
        setIcon(directEnhanceButton, 'wand');
        
        // Style the button to match other toolbar buttons
        directEnhanceButton.style.color = 'var(--text-normal)';
        directEnhanceButton.style.padding = '4px';
        directEnhanceButton.style.margin = '0 4px';
        
        directEnhanceButton.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Direct enhance button clicked');
            await this.enhanceWithAI();
        });
        
        // Create transcript content
        const transcriptContent = this.transcriptContainer.createDiv({
            cls: 'transcript-content'
        });
        
        // Format the transcript into paragraphs
        const paragraphs = this.content.split('. ').filter(p => p.trim());
        
        paragraphs.forEach(paragraph => {
            const p = transcriptContent.createDiv({
                cls: 'transcript-paragraph'
            });
            p.setText(paragraph.trim() + '.');
        });
    }

    private renderChatInterface() {
        // Create chat messages container
        const chatMessagesContainer = this.chatContainer.createDiv({
            cls: 'chat-messages-container'
        });
        
        // Let CSS handle the styling
        chatMessagesContainer.style.backgroundColor = 'var(--background-secondary)';
        chatMessagesContainer.style.borderRadius = '5px';

        // Render existing messages
        this.renderChatMessages(chatMessagesContainer);
        
        // Create chat toolbar container
        const chatToolbarContainer = this.chatContainer.createDiv({
            cls: 'chat-toolbar-container'
        });
        
        // Create toolbar with chat commands
        const toolbarContext = {
            plugin: this.plugin,
            view: this,
            content: this.content,
            videoUrl: this.videoUrl,
            activeTab: this.activeTab,
            chatMessages: this.chatState.messages,
            onClearChat: () => {
                this.chatState.messages = [];
                this.renderChatMessages(chatMessagesContainer);
                
                // Update toolbar state after clearing chat
                const chatToolbarContainer = this.chatContainer.querySelector('.chat-toolbar-container') as HTMLElement;
                if (chatToolbarContainer) {
                    const updatedContext = {
                        plugin: this.plugin,
                        view: this,
                        content: this.content,
                        videoUrl: this.videoUrl,
                        activeTab: this.activeTab,
                        chatMessages: this.chatState.messages,
                        onClearChat: () => {} // Prevent infinite recursion
                    };
                    this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, updatedContext);
                }
            }
        };
        
        this.plugin.toolbarService.createToolbar(chatToolbarContainer, 'chat', toolbarContext);

        // Create chat input container
        const chatInputContainer = this.chatContainer.createDiv({
            cls: 'chat-input-container'
        });
        
        // Create chat input
        const chatInput = chatInputContainer.createEl('input', {
            cls: 'chat-input',
            attr: {
                type: 'text',
                placeholder: 'Ask a question about the video transcript...'
            }
        });
        
        // Create send button
        const sendButton = chatInputContainer.createEl('button', {
            cls: 'chat-send-button',
            text: 'Send'
        });
        
        // Handle send button click
        const handleSend = async () => {
            const message = chatInput.value.trim();
            if (!message) return;

            // Clear input
            chatInput.value = '';

            // Add user message to chat
            this.chatState.messages.push({
                role: 'user',
                content: message
            });

            // Re-render chat messages
            chatMessagesContainer.empty();
            this.renderChatMessages(chatMessagesContainer);

            // Scroll to bottom
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            
            // Update toolbar state after user message
            const chatToolbarContainer = this.chatContainer.querySelector('.chat-toolbar-container') as HTMLElement;
            if (chatToolbarContainer) {
                const toolbarContext = {
                    plugin: this.plugin,
                    view: this,
                    content: this.content,
                    videoUrl: this.videoUrl,
                    activeTab: this.activeTab,
                    chatMessages: this.chatState.messages,
                    onClearChat: () => {
                        this.chatState.messages = [];
                        this.renderChatMessages(chatMessagesContainer);
                        
                        // Update toolbar state after clearing chat
                        const chatToolbarContainer = this.chatContainer.querySelector('.chat-toolbar-container') as HTMLElement;
                        if (chatToolbarContainer) {
                            const updatedContext = {
                                plugin: this.plugin,
                                view: this,
                                content: this.content,
                                videoUrl: this.videoUrl,
                                activeTab: this.activeTab,
                                chatMessages: this.chatState.messages,
                                onClearChat: () => {} // Prevent infinite recursion
                            };
                            this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, updatedContext);
                        }
                    }
                };
                this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, toolbarContext);
            }

            // Get AI response
            try {
                new Notice('Getting response...');
                
                // Use the OpenAI service to get a response
                const response = await this.plugin.openaiService.chatWithTranscript(
                    this.chatState.messages,
                    this.content
                );
                
                // Add assistant message to chat
                this.chatState.messages.push({
                    role: 'assistant',
                    content: response
                });
                
                // Re-render chat messages
                chatMessagesContainer.empty();
                this.renderChatMessages(chatMessagesContainer);
                
                // Scroll to bottom
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                
                // Update toolbar state after assistant message
                const chatToolbarContainer = this.chatContainer.querySelector('.chat-toolbar-container') as HTMLElement;
                if (chatToolbarContainer) {
                    const toolbarContext = {
                        plugin: this.plugin,
                        view: this,
                        content: this.content,
                        videoUrl: this.videoUrl,
                        activeTab: this.activeTab,
                        chatMessages: this.chatState.messages,
                        onClearChat: () => {
                            this.chatState.messages = [];
                            this.renderChatMessages(chatMessagesContainer);
                        }
                    };
                    this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, toolbarContext);
                }
            } catch (error) {
                new Notice('Failed to get response: ' + error.message);
                console.error('Chat Error:', error);
            }
        };

        sendButton.addEventListener('click', handleSend);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSend();
            }
        });
    }

    private renderChatMessages(container: HTMLElement) {
        if (this.chatState.messages.length === 0) {
            const emptyMessage = container.createDiv({
                cls: 'empty-chat-message',
                text: 'Ask a question about the video transcript...'
            });
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = 'var(--text-muted)';
            emptyMessage.style.padding = '20px';
            return;
        }

        this.chatState.messages.forEach(async message => {
            const messageEl = container.createDiv({
                cls: `chat-message ${message.role}-message`
            });
            messageEl.style.padding = '10px';
            messageEl.style.marginBottom = '10px';
            messageEl.style.backgroundColor = message.role === 'user' 
                ? 'var(--interactive-accent)' 
                : 'var(--background-primary)';
            messageEl.style.color = message.role === 'user' 
                ? 'var(--text-on-accent)' 
                : 'var(--text-normal)';
            messageEl.style.borderRadius = '5px';
            messageEl.style.alignSelf = message.role === 'user' ? 'flex-end' : 'flex-start';
            messageEl.style.maxWidth = '80%';

            // For assistant messages, render markdown
            if (message.role === 'assistant') {
                const markdownContainer = messageEl.createDiv();
                await MarkdownRenderer.renderMarkdown(
                    message.content,
                    markdownContainer,
                    this.app.workspace.getActiveFile()?.path || '',
                    this
                );
            } else {
                messageEl.setText(message.content);
            }
        });
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
                this.setContent(reformattedText, this.videoUrl);
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

    /**
     * Reset the view to its initial empty state
     */
    public resetView(): void {
        console.log('TranscriptionView: resetView called');
        new Notice('Resetting view...');
        
        try {
            // Clear state directly
            this.content = '';
            this.videoUrl = '';
            this.chatState = { messages: [] };
            this.summaryContent = '';
            this.activeTab = 'transcript';
            
            if (this.audioPlayer) {
                this.audioPlayer.stop();
                this.audioPlayer = null;
            }
            
            // Simple refresh
            this.refresh();
            
            // Success message
            new Notice('View reset successful!');
        } catch (error) {
            console.error('Reset error:', error);
            new Notice(`Reset error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Public method to enhance transcript with AI
     * This can be called directly from the toolbar button
     */
    public async enhanceWithAI() {
        console.log('TranscriptionView: enhanceWithAI called directly');
        
        if (!this.content) {
            console.error('TranscriptionView: No content to enhance');
            new Notice('No content to enhance with AI');
            return;
        }
        
        if (!this.plugin.settings.openaiApiKey) {
            console.error('TranscriptionView: No OpenAI API key set');
            new Notice('Please set your OpenAI API key in settings');
            return;
        }
        
        // Show a persistent notification while processing
        const loadingNotice = new Notice('Summarizing...', 0);
        
        try {
            console.log('TranscriptionView: Calling reformatText with content length:', this.content.length);
            const formattedContent = await this.plugin.openaiService.reformatText(this.content);
            console.log('TranscriptionView: Received formatted content, length:', formattedContent?.length);
            
            if (!formattedContent) {
                throw new Error('Received empty response from OpenAI');
            }
            
            // Set the summary content - this method will also switch to the summary tab
            this.setSummaryContent(formattedContent);
            
            // Hide the loading notice and show success
            loadingNotice.hide();
            new Notice('Summary created successfully');
        } catch (error) {
            console.error('TranscriptionView: Error enhancing with AI:', error);
            loadingNotice.hide();
            new Notice(`AI enhancement error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async renderSummaryContent() {
        // Create summary toolbar container at the top
        const summaryToolbarContainer = this.summaryContainer.createDiv({
            cls: 'summary-toolbar-container'
        });
        
        // Create toolbar with summary commands
        const toolbarContext = {
            plugin: this.plugin,
            view: this,
            content: this.summaryContent,
            videoUrl: this.videoUrl,
            activeTab: this.activeTab
        };
        
        // Create summary toolbar
        this.plugin.toolbarService.createToolbar(summaryToolbarContainer, 'summary', toolbarContext);
        
        // Create summary content div
        const summaryContentEl = this.summaryContainer.createDiv({
            cls: 'summary-content'
        });
        
        // Render markdown content
        await MarkdownRenderer.renderMarkdown(
            this.summaryContent,
            summaryContentEl,
            this.app.workspace.getActiveFile()?.path || '',
            this
        );
    }
    
    public setSummaryContent(content: string) {
        console.log('TranscriptionView: setSummaryContent called', {
            contentLength: content?.length,
            activeTabBefore: this.activeTab
        });
        
        if (!content) {
            console.error('TranscriptionView: Empty content provided to setSummaryContent');
            new Notice('Cannot display empty summary');
            return;
        }
        
        this.summaryContent = content;
        
        // Switch to summary tab
        this.switchToTab('summary');
        
        // We need to completely refresh the summary container rather than the whole view
        this.summaryContainer.empty();
        
        try {
            // Create summary toolbar container at the top
            const summaryToolbarContainer = this.summaryContainer.createDiv({
                cls: 'summary-toolbar-container'
            });
            
            // Create toolbar with summary commands
            const toolbarContext = {
                plugin: this.plugin,
                view: this,
                content: this.summaryContent,
                videoUrl: this.videoUrl,
                activeTab: this.activeTab
            };
            
            // Create summary toolbar
            this.plugin.toolbarService.createToolbar(summaryToolbarContainer, 'summary', toolbarContext);
            
            // Create summary content div
            const summaryContentEl = this.summaryContainer.createDiv({
                cls: 'summary-content'
            });
            
            // Render markdown content immediately
            MarkdownRenderer.renderMarkdown(
                this.summaryContent,
                summaryContentEl,
                this.app.workspace.getActiveFile()?.path || '',
                this
            );
            
            console.log('TranscriptionView: Summary content set and displayed successfully');
        } catch (error) {
            console.error('TranscriptionView: Error setting summary content', error);
            new Notice(`Error displaying summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Helper method to switch tabs programmatically
     * This ensures consistent tab switching behavior across the plugin
     */
    private switchToTab(tabName: 'transcript' | 'chat' | 'summary') {
        console.log(`TranscriptionView: Switching to ${tabName} tab`);
        
        // Update active tab
        this.activeTab = tabName;
        
        // Update container visibility
        if (this.transcriptContainer) {
            this.transcriptContainer.style.display = tabName === 'transcript' ? 'block' : 'none';
        }
        if (this.chatContainer) {
            this.chatContainer.style.display = tabName === 'chat' ? 'block' : 'none';
        }
        if (this.summaryContainer) {
            this.summaryContainer.style.display = tabName === 'summary' ? 'block' : 'none';
        }
        
        // Update tab styles
        const tabItems = this.containerEl.querySelectorAll('.tab-item');
        tabItems.forEach(tab => {
            const tabEl = tab as HTMLElement;
            if (tabEl.textContent === this.capitalizeFirstLetter(tabName)) {
                tabEl.classList.add('active');
                tabEl.style.borderBottom = '2px solid var(--text-accent)';
                tabEl.style.fontWeight = 'bold';
            } else {
                tabEl.classList.remove('active');
                tabEl.style.borderBottom = '2px solid transparent';
                tabEl.style.fontWeight = 'normal';
            }
        });
    }
    
    /**
     * Helper method to capitalize the first letter of a string
     */
    private capitalizeFirstLetter(string: string): string {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    /**
     * Get a fresh command context for toolbar commands
     * This ensures that toolbar commands always have the latest state
     */
    public getCommandContext(): CommandContext {
        // Return a fresh context with the latest state
        return {
            plugin: this.plugin,
            view: this,  // Make sure this reference is correctly maintained
            content: this.content,
            videoUrl: this.videoUrl,
            activeTab: this.activeTab,
            chatMessages: this.chatState.messages,
            onClearChat: () => {
                this.chatState.messages = [];
                this.renderChatMessages(this.chatContainer);
            }
        };
    }
} 