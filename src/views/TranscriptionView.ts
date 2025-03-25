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
    private activeTab: 'transcript' | 'revised' | 'summary' | 'chat' = 'transcript';
    private transcriptContainer: HTMLElement;
    private revisedContainer: HTMLElement;
    private chatContainer: HTMLElement;
    private summaryContainer: HTMLElement;
    private summaryContent: string = '';
    private revisedContent: string = '';
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

        // Create revised container
        this.revisedContainer = contentWrapper.createDiv({
            cls: 'revised-container markdown-preview-view'
        });
        this.revisedContainer.style.overflowY = 'auto';
        this.revisedContainer.style.display = this.activeTab === 'revised' ? 'block' : 'none';
        
        // Create summary container
        this.summaryContainer = contentWrapper.createDiv({
            cls: 'summary-container markdown-preview-view'
        });
        this.summaryContainer.style.overflowY = 'auto';
        this.summaryContainer.style.display = this.activeTab === 'summary' ? 'block' : 'none';

        // Create chat container
        this.chatContainer = contentWrapper.createDiv({
            cls: 'chat-container'
        });
        this.chatContainer.style.display = this.activeTab === 'chat' ? 'block' : 'none';

        // Render transcript content
        if (this.content) {
            await this.renderTranscriptContent();
        }

        // Render revised content if available
        if (this.revisedContent) {
            await this.renderRevisedContent();
        }
        
        // Render summary content if available
        if (this.summaryContent) {
            await this.renderSummaryContent();
        }

        // Render chat interface
        this.renderChatInterface();
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

        // Only show top toolbar if we have content
        if (this.content) {
            // Create the top toolbar using the ToolbarService
            const toolbarContext = {
                plugin: this.plugin,
                view: this,
                content: this.content,
                videoUrl: this.videoUrl,
                activeTab: this.activeTab
            };

            // Use the ToolbarService to create a consistent top toolbar
            this.plugin.toolbarService.createToolbar(header, 'top', toolbarContext);
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
        
        // Revised tab
        const revisedTab = this.createTabItem(tabsContainer, 'Revised', this.activeTab === 'revised');
        
        // Summary tab
        const summaryTab = this.createTabItem(tabsContainer, 'Summary', this.activeTab === 'summary');
        
        // Chat tab
        const chatTab = this.createTabItem(tabsContainer, 'Chat', this.activeTab === 'chat');
        
        // Add click handlers
        transcriptTab.addEventListener('click', () => {
            this.switchToTab('transcript');
            // Refresh the view to update toolbars
            this.refresh();
        });
        
        revisedTab.addEventListener('click', () => {
            this.switchToTab('revised');
            // Refresh the view to update toolbars
            this.refresh();
        });
        
        summaryTab.addEventListener('click', () => {
            this.switchToTab('summary');
            // Refresh the view to update toolbars
            this.refresh();
        });
        
        chatTab.addEventListener('click', () => {
            this.switchToTab('chat');
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
        
        // Create toolbar with transcript commands
        const toolbarContext = this.getCommandContext();
        
        console.log('TranscriptionView: Creating transcript toolbar with context', {
            hasContent: !!toolbarContext.content,
            contentLength: toolbarContext.content?.length,
            hasPlugin: !!toolbarContext.plugin,
            hasApiKey: !!toolbarContext.plugin?.settings?.openaiApiKey,
            view: toolbarContext.view?.constructor.name
        });
        
        // Create transcript toolbar using the ToolbarService
        this.plugin.toolbarService.createToolbar(transcriptToolbarContainer, 'transcript', toolbarContext);
        
        // Create content div
        const transcriptContentEl = this.transcriptContainer.createDiv({
            cls: 'transcript-content'
        });
        
        // Create paragraphs from the content
        const paragraphs = this.content.split('. ').filter(p => p.trim());
        
        // Render paragraphs
        paragraphs.forEach(paragraph => {
            const p = transcriptContentEl.createEl('p', {
                cls: 'transcript-paragraph'
            });
            p.textContent = paragraph.trim() + '.';
        });
    }

    private renderChatInterface() {
        // Render chat messages if any
        const chatMessagesContainer = this.chatContainer.createDiv({
            cls: 'chat-messages-container'
        });
        
        this.renderChatMessages(chatMessagesContainer);
        
        // Create chat toolbar container
        const chatToolbarContainer = this.chatContainer.createDiv({
            cls: 'chat-toolbar-container'
        });
        
        // Get fresh command context for the toolbar
        const toolbarContext = this.getCommandContext();
        
        // Create chat toolbar with standard context
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
                this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, this.getCommandContext());
            }

            // Get AI response
            try {
                // Notice removed
                
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
                    this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, this.getCommandContext());
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
     * Public method to enhance transcript with AI (create summary)
     * This can be called directly from the toolbar button
     */
    public async enhanceWithAI(): Promise<void> {
        // Add clear console message with distinctive styling
        console.log('%c TranscriptionView.enhanceWithAI called!', 'background: #007700; color: white; font-size: 20px; padding: 5px;');
        
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
            
            // Hide the loading notice
            loadingNotice.hide();
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
        
        // Create toolbar with summary commands using the standard context
        const toolbarContext = this.getCommandContext();
        
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
            
            // Create toolbar with summary commands using the standard context
            const toolbarContext = this.getCommandContext();
            
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
    private switchToTab(tabName: 'transcript' | 'revised' | 'summary' | 'chat') {
        console.log(`TranscriptionView: Switching to ${tabName} tab`);
        
        // Update active tab
        this.activeTab = tabName;
        
        // Update container visibility
        if (this.transcriptContainer) {
            this.transcriptContainer.style.display = tabName === 'transcript' ? 'block' : 'none';
        }
        if (this.revisedContainer) {
            this.revisedContainer.style.display = tabName === 'revised' ? 'block' : 'none';
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
        // Determine which content to use based on the active tab
        let tabContent = this.content;
        if (this.activeTab === 'revised' && this.revisedContent) {
            tabContent = this.revisedContent;
        } else if (this.activeTab === 'summary' && this.summaryContent) {
            tabContent = this.summaryContent;
        }
        
        // Return a fresh context with the latest state
        return {
            plugin: this.plugin,
            view: this,  // Make sure this reference is correctly maintained
            content: tabContent,
            originalContent: this.content,  // Always include the original transcript
            revisedContent: this.revisedContent,
            summaryContent: this.summaryContent,
            videoUrl: this.videoUrl,
            activeTab: this.activeTab,
            chatMessages: this.chatState.messages,
            onClearChat: () => {
                this.chatState.messages = [];
                this.renderChatMessages(this.chatContainer);
            }
        };
    }

    /**
     * Render content in the revised tab
     */
    private async renderRevisedContent() {
        // Create revised toolbar container at the top
        const revisedToolbarContainer = this.revisedContainer.createDiv({
            cls: 'revised-toolbar-container'
        });
        
        // Create toolbar with revised commands using the standard context
        const toolbarContext = this.getCommandContext();
        
        // Create revised toolbar
        this.plugin.toolbarService.createToolbar(revisedToolbarContainer, 'revised', toolbarContext);
        
        // Create revised content div
        const revisedContentEl = this.revisedContainer.createDiv({
            cls: 'revised-content'
        });
        
        // Render markdown content
        await MarkdownRenderer.renderMarkdown(
            this.revisedContent,
            revisedContentEl,
            this.app.workspace.getActiveFile()?.path || '',
            this
        );
    }
    
    /**
     * Set content for the revised tab
     */
    public setRevisedContent(content: string) {
        console.log('TranscriptionView: setRevisedContent called', {
            contentLength: content?.length,
            activeTabBefore: this.activeTab
        });
        
        if (!content) {
            console.error('TranscriptionView: Empty content provided to setRevisedContent');
            new Notice('Cannot display empty revised content');
            return;
        }
        
        this.revisedContent = content;
        
        // Switch to revised tab
        this.switchToTab('revised');
        
        // We need to completely refresh the revised container rather than the whole view
        this.revisedContainer.empty();
        
        try {
            // Create revised toolbar container at the top
            const revisedToolbarContainer = this.revisedContainer.createDiv({
                cls: 'revised-toolbar-container'
            });
            
            // Create toolbar with revised commands using the standard context
            const toolbarContext = this.getCommandContext();
            
            // Create revised toolbar
            this.plugin.toolbarService.createToolbar(revisedToolbarContainer, 'revised', toolbarContext);
            
            // Create revised content div
            const revisedContentEl = this.revisedContainer.createDiv({
                cls: 'revised-content'
            });
            
            // Render markdown content immediately
            MarkdownRenderer.renderMarkdown(
                this.revisedContent,
                revisedContentEl,
                this.app.workspace.getActiveFile()?.path || '',
                this
            );
            
            console.log('TranscriptionView: Revised content set and displayed successfully');
        } catch (error) {
            console.error('TranscriptionView: Error setting revised content', error);
            new Notice(`Error displaying revised content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create a revised version of the transcript
     * This applies grammar corrections and formatting to make the raw transcript more readable
     * Can be called directly from toolbar buttons
     */
    public async createRevisedContent(): Promise<void> {
        // Add clear console message with distinctive styling
        console.log('%c TranscriptionView.createRevisedContent called!', 'background: #000077; color: white; font-size: 20px; padding: 5px;');
        
        if (!this.content) {
            console.error('TranscriptionView: No content to revise');
            new Notice('No content to revise');
            return;
        }
        
        if (!this.plugin.settings.openaiApiKey) {
            console.error('TranscriptionView: No OpenAI API key set');
            new Notice('Please set your OpenAI API key in settings');
            return;
        }
        
        // Show a persistent notification while processing
        const loadingNotice = new Notice('Creating revised version...', 0);
        
        try {
            console.log('TranscriptionView: Creating revised content for transcript with length:', this.content.length);
            
            // Use the specialized method for creating revised transcripts
            const revisedContent = await this.plugin.openaiService.createRevisedTranscript(this.content);
            
            console.log('TranscriptionView: Received revised content, length:', revisedContent?.length);
            
            if (!revisedContent) {
                throw new Error('Received empty response from OpenAI');
            }
            
            // Set the revised content
            this.setRevisedContent(revisedContent);
            
            // Hide the loading notice
            loadingNotice.hide();
        } catch (error) {
            console.error('TranscriptionView: Error creating revised content:', error);
            loadingNotice.hide();
            new Notice(`Revision error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Reset the view to its initial empty state
     * Can be called directly from toolbar buttons
     */
    public resetView(): void {
        // Add clear console message
        console.log('%c TranscriptionView.resetView called!', 'background: #770000; color: white; padding: 2px;');
        
        try {
            // Clear state directly
            this.content = '';
            this.videoUrl = '';
            this.chatState = { messages: [] };
            this.summaryContent = '';
            this.revisedContent = '';
            this.activeTab = 'transcript';
            
            if (this.audioPlayer) {
                this.audioPlayer.stop();
                this.audioPlayer = null;
            }
            
            // Simple refresh
            this.refresh();
            
            new Notice('View reset successfully');
        } catch (error) {
            console.error('Reset error:', error);
            new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Obsidian lifecycle method called when the view is closed
     * Clean up resources and references
     */
    public onClose(): Promise<void> {
        console.log('TranscriptionView: onClose called');
        
        // Clean up event listeners
        this.registerDomEvent(window, 'resize', () => {
            // This will be automatically removed by Obsidian
        });
        
        // Clean up references in the ToolbarService to prevent memory leaks
        if (this.plugin && this.plugin.toolbarService) {
            // Clean up view references for all toolbar types
            this.plugin.toolbarService.cleanupViewReferences('transcript');
            this.plugin.toolbarService.cleanupViewReferences('revised');
            this.plugin.toolbarService.cleanupViewReferences('summary');
            this.plugin.toolbarService.cleanupViewReferences('chat');
            
            console.log('TranscriptionView: Cleaned up view references in ToolbarService');
        }
        
        return Promise.resolve();
    }
} 