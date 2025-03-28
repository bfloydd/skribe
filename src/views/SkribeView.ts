import { ItemView, WorkspaceLeaf, setIcon, Notice, MarkdownRenderer } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';
import { AudioPlayer } from '../services/AudioPlayer';
import { ChatMessage, ChatState, CommandContext } from '../types';
import { getLogoPath } from '../utils/imageLoader';

export const VIEW_TYPE_SKRIBE = "skribe-view";

export class SkribeView extends ItemView {
    content: string;
    plugin: SkribePlugin;
    contentEl: HTMLElement;
    private audioPlayer: AudioPlayer | null = null;
    private videoUrl: string = '';
    private videoTitle: string = '';
    private chatState: ChatState = { messages: [] };
    private activeTab: 'transcript' | 'revised' | 'summary' | 'chat' = 'transcript';
    private transcriptContainer: HTMLElement;
    private revisedContainer: HTMLElement;
    private chatContainer: HTMLElement;
    private summaryContainer: HTMLElement;
    private summaryContent: string = '';
    private revisedContent: string = '';
    private chatInput: HTMLInputElement | null = null;
    private welcomeMessages: string[] = [
        'Hello, Skribe!',
        'Hire a Skribe',
        'Skribe a Video'
    ];
    private showQuips: boolean = true;

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
        return VIEW_TYPE_SKRIBE;
    }

    getDisplayText() {
        return "Skribe";
    }

    getMobileDisplayText() {
        return "Skribe";
    }

    setContent(content: string, videoUrl?: string, videoTitle?: string) {
        this.content = content;
        if (videoUrl) {
            // Clean the URL before storing it
            const cleanVideoUrl = this.plugin.youtubeService.cleanYouTubeUrl(videoUrl);
            this.videoUrl = cleanVideoUrl;
            this.chatState.videoUrl = cleanVideoUrl;
        }
        if (videoTitle) {
            this.videoTitle = videoTitle;
            this.chatState.videoTitle = videoTitle;
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
                    src: getLogoPath(this.plugin.app, this.plugin.manifest.dir || ''),
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
                cls: 'empty-state-get-button'
            });
            
            // Add send icon
            setIcon(getButton, 'arrow-right');
            
            getButton.style.padding = '8px 16px';
            getButton.style.borderRadius = '4px';
            getButton.style.backgroundColor = 'var(--interactive-accent)';
            getButton.style.color = 'var(--text-on-accent)';
            getButton.style.cursor = 'pointer';
            getButton.style.border = 'none';
            getButton.style.fontWeight = 'bold';
            getButton.style.display = 'flex';
            getButton.style.justifyContent = 'center';
            getButton.style.alignItems = 'center';
            
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
            
            // Auto-focus on the URL input field
            setTimeout(() => {
                urlInput.focus();
            }, 50);
            
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
        
        // Create revised container
        this.revisedContainer = contentWrapper.createDiv({
            cls: 'revised-container markdown-preview-view'
        });
        
        // Create summary container
        this.summaryContainer = contentWrapper.createDiv({
            cls: 'summary-container markdown-preview-view'
        });

        // Create chat container
        this.chatContainer = contentWrapper.createDiv({
            cls: 'chat-container'
        });
        
        // Set initial visibility based on active tab
        this.transcriptContainer.style.display = this.activeTab === 'transcript' ? 'block' : 'none';
        this.revisedContainer.style.display = this.activeTab === 'revised' ? 'block' : 'none';
        this.summaryContainer.style.display = this.activeTab === 'summary' ? 'block' : 'none';
        this.chatContainer.style.display = this.activeTab === 'chat' ? 'block' : 'none';

        // Render transcript content
        if (this.content) {
            await this.renderTranscriptContent();
        }

        // Always render revised container and toolbar, even when empty
        await this.renderRevisedToolbar();
        
        // Always render summary container and toolbar, even when empty
        await this.renderSummaryToolbar();
        
        // If there's actual content, render it
        if (this.revisedContent) {
            await this.renderRevisedContent();
        }
        
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
        
        // Add title display
        if (this.videoTitle) {
            const titleElement = urlContainer.createEl('div', {
                cls: 'video-title',
                text: this.videoTitle
            });
        }
        
        // Clean the YouTube URL before displaying
        const cleanVideoUrl = this.plugin.youtubeService.cleanYouTubeUrl(this.videoUrl);
        
        const urlLink = urlContainer.createEl('a', {
            text: cleanVideoUrl,
            href: cleanVideoUrl,
            cls: 'video-url-link'
        });
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
        console.log('SkribeView: renderTranscriptContent called');
        
        // Create transcript toolbar container at the top
        const transcriptToolbarContainer = this.transcriptContainer.createDiv({
            cls: 'transcript-toolbar-container'
        });
        
        // Create toolbar with transcript commands
        const toolbarContext = this.getCommandContext();
        
        console.log('SkribeView: Creating transcript toolbar with context', {
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
        if (!this.chatContainer) return;
        this.chatContainer.empty();
        
        // Create chat toolbar container first (at the top)
        const chatToolbarContainer = this.chatContainer.createDiv({
            cls: 'chat-toolbar-container'
        });
        
        // Get fresh command context for the toolbar
        const toolbarContext = this.getCommandContext();
        
        // Create chat toolbar with standard context
        this.plugin.toolbarService.createToolbar(chatToolbarContainer, 'chat', toolbarContext);
        
        // Create chat messages container
        const chatMessagesContainer = this.chatContainer.createDiv({
            cls: 'chat-messages-container'
        });
        
        // Create chat input container (at the bottom)
        const chatInputContainer = this.chatContainer.createDiv({
            cls: 'chat-input-container'
        });
        
        // Create chat input
        const chatInput = chatInputContainer.createEl('input', {
            cls: 'chat-input',
            attr: {
                type: 'text',
                placeholder: 'Ask a question...'
            }
        });
        
        // Store a reference to the chat input
        this.chatInput = chatInput;
        
        // Create split button container
        const splitButtonContainer = chatInputContainer.createDiv({
            cls: 'split-button-container'
        });
        
        // Create main button part
        const sendButton = splitButtonContainer.createEl('button', {
            cls: 'split-button-main'
        });
        
        // Add send icon
        setIcon(sendButton, 'arrow-right');
        
        // Create dropdown part
        const dropdownButton = splitButtonContainer.createEl('button', {
            cls: 'split-button-dropdown'
        });
        
        // Add dropdown icon
        setIcon(dropdownButton, 'chevron-down');
        
        // Create dropdown menu (initially hidden)
        const quipsDropdownMenu = this.chatContainer.createDiv({
            cls: 'quips-dropdown-menu'
        });
        quipsDropdownMenu.style.display = 'none';
        
        // Populate dropdown with quips
        this.populateQuipsDropdown(quipsDropdownMenu);
        
        // Toggle dropdown on click
        dropdownButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle active state
            dropdownButton.classList.toggle('active');
            
            // Toggle dropdown visibility
            if (quipsDropdownMenu.style.display === 'none') {
                quipsDropdownMenu.style.display = 'block';
                // Close dropdown when clicking outside
                document.addEventListener('click', closeDropdown);
            } else {
                quipsDropdownMenu.style.display = 'none';
                // Remove event listener
                document.removeEventListener('click', closeDropdown);
            }
        });
        
        // Close dropdown function
        const closeDropdown = (e: MouseEvent) => {
            // Check if click is outside dropdown
            if (!quipsDropdownMenu.contains(e.target as Node) && e.target !== dropdownButton) {
                quipsDropdownMenu.style.display = 'none';
                dropdownButton.classList.remove('active');
                document.removeEventListener('click', closeDropdown);
            }
        };
        
        // Handle send button click
        const handleSend = async () => {
            const message = chatInput.value.trim();
            if (!message) return;

            // Clear input
            chatInput.value = '';
            
            // Hide quips when a message is sent
            this.showQuips = false;
            
            // Hide dropdown if it's open
            quipsDropdownMenu.style.display = 'none';
            dropdownButton.classList.remove('active');

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
            if (chatToolbarContainer) {
                this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, this.getCommandContext());
            }

            // Get AI response
            try {
                // Use the OpenAI service to get a response
                const response = await this.plugin.openaiService.chatWithTranscript(
                    this.chatState.messages,
                    this.content,
                    this.videoTitle
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
        
        // Render chat messages
        this.renderChatMessages(chatMessagesContainer);
    }
    
    // Helper to populate the quips dropdown
    private populateQuipsDropdown(dropdownMenu: HTMLElement) {
        dropdownMenu.empty();
        
        // Set dropdown position and styling
        dropdownMenu.style.position = 'absolute';
        dropdownMenu.style.bottom = '60px'; // Position above the input bar
        dropdownMenu.style.right = '10px';
        dropdownMenu.style.maxHeight = '300px';
        dropdownMenu.style.overflowY = 'auto';
        dropdownMenu.style.zIndex = '1000';
        
        // If no quips, show a message
        if (!this.plugin.settings.quips || this.plugin.settings.quips.length === 0) {
            const noQuipsItem = dropdownMenu.createDiv({
                cls: 'quips-dropdown-item',
                text: 'No quick messages available.'
            });
            return;
        }
        
        // Create a header item
        const headerItem = dropdownMenu.createDiv({
            cls: 'quips-dropdown-item'
        });
        headerItem.style.fontWeight = 'bold';
        headerItem.style.borderBottom = '2px solid var(--background-modifier-border)';
        headerItem.style.color = 'var(--text-accent)';
        headerItem.setText('Quick Messages');
        
        // Add each quip as a dropdown item
        this.plugin.settings.quips.forEach(quip => {
            const quipItem = dropdownMenu.createDiv({
                cls: 'quips-dropdown-item'
            });
            
            // Truncate text if too long
            const displayText = quip.length > 40 ? quip.substring(0, 40) + '...' : quip;
            quipItem.setText(displayText);
            
            // Handle click on quip item
            quipItem.addEventListener('click', () => {
                // Hide quips display
                this.showQuips = false;
                dropdownMenu.style.display = 'none';
                
                // Remove active class from dropdown button
                const dropdownButton = this.chatContainer.querySelector('.split-button-dropdown') as HTMLElement;
                if (dropdownButton) {
                    dropdownButton.classList.remove('active');
                }
                
                // Add user message
                this.chatState.messages.push({
                    role: 'user',
                    content: quip
                });
                
                // Re-render chat messages
                const chatMessagesContainer = this.chatContainer.querySelector('.chat-messages-container') as HTMLElement;
                if (chatMessagesContainer) {
                    chatMessagesContainer.empty();
                    this.renderChatMessages(chatMessagesContainer);
                    
                    // Process AI response
                    this.processAIResponse(chatMessagesContainer);
                }
            });
        });
    }

    private renderChatMessages(container: HTMLElement) {
        // Check if we should show quips
        if (this.showQuips && this.chatState.messages.length === 0) {
            // Show quip cards if any are defined in settings
            if (this.plugin.settings.quips && this.plugin.settings.quips.length > 0) {
                const quipsContainer = container.createDiv({
                    cls: 'quips-cards-container'
                });
                
                this.plugin.settings.quips.forEach(quip => {
                    const quipCard = quipsContainer.createDiv({
                        cls: 'quip-card'
                    });
                    
                    const quipText = quipCard.createDiv({
                        cls: 'quip-card-text',
                        text: quip
                    });
                    
                    // Add click handler to submit quip as chat message
                    quipCard.addEventListener('click', () => {
                        // Hide quips
                        this.showQuips = false;
                        
                        // Add user message
                        this.chatState.messages.push({
                            role: 'user',
                            content: quip
                        });
                        
                        // Re-render chat messages
                        container.empty();
                        this.renderChatMessages(container);
                        
                        // Process AI response
                        this.processAIResponse(container);
                    });
                });
                
                return;
            }
            
            // Show empty state if no quips and no messages
            const emptyMessage = container.createDiv({
                cls: 'empty-chat-message',
                text: 'Ask a question...'
            });
            return;
        }

        // Display existing chat messages
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
    
    // Helper method to process AI response
    private async processAIResponse(container: HTMLElement) {
        try {
            // Get AI response
            const response = await this.plugin.openaiService.chatWithTranscript(
                this.chatState.messages,
                this.content,
                this.videoTitle
            );
            
            // Add assistant message to chat
            this.chatState.messages.push({
                role: 'assistant',
                content: response
            });
            
            // Re-render chat messages
            container.empty();
            this.renderChatMessages(container);
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
            
            // Update toolbar state after assistant message
            const chatToolbarContainer = this.chatContainer.querySelector('.chat-toolbar-container') as HTMLElement;
            if (chatToolbarContainer) {
                this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, this.getCommandContext());
            }
        } catch (error) {
            new Notice('Failed to get response: ' + error.message);
            console.error('Chat Error:', error);
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

            // Create filename with timestamp based on settings
            let filename = '';
            if (this.plugin.settings.includeTimestampInFilename === true) {
                // With timestamp
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toLocaleTimeString('en-US', { 
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                }).replace(':', '-');
                const timestamp = `${dateStr}-${timeStr}`;
                
                // Determine if we should include content type suffix
                if (this.plugin.settings.includeContentTypeInFilename === true) {
                    filename = `${folderPath}/transcript-${timestamp}.md`;
                } else {
                    filename = `${folderPath}/${timestamp}.md`;
                }
            } else {
                // Without timestamp
                // Determine if we should include content type suffix
                if (this.plugin.settings.includeContentTypeInFilename === true) {
                    filename = `${folderPath}/transcript.md`;
                } else {
                    filename = `${folderPath}/content.md`;
                }
            }

            // Use the plugin's helper method to create the file
            await this.plugin.createFileWithUniqueName(filename, this.formatTranscript(), true);
            new Notice(`Transcript saved and opened`);
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
        console.log('%c SkribeView.enhanceWithAI called!', 'background: #007700; color: white; font-size: 20px; padding: 5px;');
        
        if (!this.content) {
            console.error('SkribeView: No content to enhance');
            new Notice('No content to enhance with AI');
            return;
        }
        
        if (!this.plugin.settings.openaiApiKey) {
            console.error('SkribeView: No OpenAI API key set');
            new Notice('Please set your OpenAI API key in settings');
            return;
        }
        
        // Show a persistent notification while processing
        const loadingNotice = new Notice('Summarizing...', 0);
        
        try {
            console.log('SkribeView: Calling reformatText with content length:', this.content.length);
            const formattedContent = await this.plugin.openaiService.reformatText(this.content);
            console.log('SkribeView: Received formatted content, length:', formattedContent?.length);
            
            if (!formattedContent) {
                throw new Error('Received empty response from OpenAI');
            }
            
            // Set the summary content - this method will also switch to the summary tab
            this.setSummaryContent(formattedContent);
            
            // Hide the loading notice
            loadingNotice.hide();
        } catch (error) {
            console.error('SkribeView: Error enhancing with AI:', error);
            loadingNotice.hide();
            new Notice(`AI enhancement error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async renderSummaryContent() {
        // Clear container first
        this.summaryContainer.empty();
        
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
        console.log('SkribeView: setSummaryContent called', {
            contentLength: content?.length,
            activeTabBefore: this.activeTab
        });
        
        if (!content) {
            console.error('SkribeView: Empty content provided to setSummaryContent');
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
            
            console.log('SkribeView: Summary content set and displayed successfully');
        } catch (error) {
            console.error('SkribeView: Error setting summary content', error);
            new Notice(`Error displaying summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Helper method to switch tabs programmatically
     * This ensures consistent tab switching behavior across the plugin
     */
    private switchToTab(tabName: 'transcript' | 'revised' | 'summary' | 'chat') {
        console.log(`SkribeView: Switching to ${tabName} tab`);
        
        // Update active tab
        this.activeTab = tabName;
        
        // Update container visibility
        if (this.transcriptContainer) {
            this.transcriptContainer.style.display = tabName === 'transcript' ? 'block' : 'none';
        }
        
        if (this.revisedContainer) {
            this.revisedContainer.style.display = tabName === 'revised' ? 'block' : 'none';
            
            // Ensure the revised tab has a toolbar when switching to it
            if (tabName === 'revised' && !this.revisedContent) {
                // If there's no content and we're switching to it, ensure toolbar is shown
                this.renderRevisedToolbar();
            }
        }
        
        if (this.summaryContainer) {
            this.summaryContainer.style.display = tabName === 'summary' ? 'block' : 'none';
            
            // Ensure the summary tab has a toolbar when switching to it
            if (tabName === 'summary' && !this.summaryContent) {
                // If there's no content and we're switching to it, ensure toolbar is shown
                this.renderSummaryToolbar();
            }
        }
        
        if (this.chatContainer) {
            this.chatContainer.style.display = tabName === 'chat' ? 'block' : 'none';
            
            // Focus on chat input when switching to chat tab
            if (tabName === 'chat') {
                // Use setTimeout to ensure the focus happens after the display change
                setTimeout(() => {
                    // Try the stored reference first
                    if (this.chatInput) {
                        this.chatInput.focus();
                    } else {
                        // Fallback to finding it in the DOM
                        const chatInput = this.chatContainer.querySelector('.chat-input') as HTMLInputElement;
                        if (chatInput) {
                            chatInput.focus();
                        }
                    }
                }, 50);
            }
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
        // Create a fresh context object for toolbar commands
        const context: CommandContext = {
            plugin: this.plugin,
            view: this,
            content: this.content,
            videoUrl: this.videoUrl,
            videoTitle: this.videoTitle,
            activeTab: this.activeTab,
            chatMessages: this.chatState?.messages || [],
            chatState: this.chatState,
            summaryContent: this.summaryContent,
            revisedContent: this.revisedContent,
            showQuips: this.showQuips
        };
        
        return context;
    }

    /**
     * Render content in the revised tab
     */
    private async renderRevisedContent() {
        // Clear container first
        this.revisedContainer.empty();
        
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
        console.log('SkribeView: setRevisedContent called', {
            contentLength: content?.length,
            activeTabBefore: this.activeTab
        });
        
        if (!content) {
            console.error('SkribeView: Empty content provided to setRevisedContent');
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
            
            console.log('SkribeView: Revised content set and displayed successfully');
        } catch (error) {
            console.error('SkribeView: Error setting revised content', error);
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
        console.log('%c SkribeView.createRevisedContent called!', 'background: #000077; color: white; font-size: 20px; padding: 5px;');
        
        if (!this.content) {
            console.error('SkribeView: No content to revise');
            new Notice('No content to revise');
            return;
        }
        
        if (!this.plugin.settings.openaiApiKey) {
            console.error('SkribeView: No OpenAI API key set');
            new Notice('Please set your OpenAI API key in settings');
            return;
        }
        
        // Show a persistent notification while processing
        const loadingNotice = new Notice('Creating revised version...', 0);
        
        try {
            console.log('SkribeView: Creating revised content for transcript with length:', this.content.length);
            
            // Use the specialized method for creating revised transcripts
            const revisedContent = await this.plugin.openaiService.createRevisedTranscript(this.content);
            
            console.log('SkribeView: Received revised content, length:', revisedContent?.length);
            
            if (!revisedContent) {
                throw new Error('Received empty response from OpenAI');
            }
            
            // Set the revised content
            this.setRevisedContent(revisedContent);
            
            // Hide the loading notice
            loadingNotice.hide();
        } catch (error) {
            console.error('SkribeView: Error creating revised content:', error);
            loadingNotice.hide();
            new Notice(`Revision error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Reset the view to its initial empty state
     * Can be called directly from toolbar buttons
     */
    public resetView(): void {
        // Reset all content
        this.content = '';
        this.videoUrl = '';
        this.videoTitle = '';
        this.summaryContent = '';
        this.revisedContent = '';
        this.chatState = { messages: [] };
        this.showQuips = true; // Reset the showQuips flag
        
        // Switch back to transcript tab 
        this.activeTab = 'transcript';
        
        // Refresh the view
        this.refresh();
    }

    /**
     * Obsidian lifecycle method called when the view is closed
     * Clean up resources and references
     */
    public onClose(): Promise<void> {
        console.log('SkribeView: onClose called');
        
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
            
            console.log('SkribeView: Cleaned up view references in ToolbarService');
        }
        
        return Promise.resolve();
    }

    // Update existing clearChat method or add if not exists
    public clearChat() {
        this.chatState.messages = [];
        this.showQuips = true; // Show quips again when chat is cleared
        
        if (this.chatContainer) {
            const chatMessagesContainer = this.chatContainer.querySelector('.chat-messages-container') as HTMLElement;
            if (chatMessagesContainer) {
                chatMessagesContainer.empty();
                this.renderChatMessages(chatMessagesContainer);
            }
        }
    }

    // New method to render just the Revised toolbar
    private async renderRevisedToolbar() {
        // Create revised toolbar container at the top if it doesn't exist
        let revisedToolbarContainer = this.revisedContainer.querySelector('.revised-toolbar-container') as HTMLElement;
        if (!revisedToolbarContainer) {
            revisedToolbarContainer = this.revisedContainer.createDiv({
                cls: 'revised-toolbar-container'
            });
        }
        
        // Create toolbar with revised commands
        const toolbarContext = this.getCommandContext();
        this.plugin.toolbarService.createToolbar(revisedToolbarContainer, 'revised', toolbarContext);
        
        // Add an empty content message if there's no content
        if (!this.revisedContent) {
            const emptyContentEl = this.revisedContainer.createDiv({
                cls: 'empty-content-message'
            });
            emptyContentEl.setText('No revised content yet. Click "Create Revised Version" to generate one.');
            emptyContentEl.style.textAlign = 'center';
            emptyContentEl.style.marginTop = '40px';
            emptyContentEl.style.color = 'var(--text-muted)';
            emptyContentEl.style.fontStyle = 'italic';
        }
    }
    
    // New method to render just the Summary toolbar
    private async renderSummaryToolbar() {
        // Create summary toolbar container at the top if it doesn't exist
        let summaryToolbarContainer = this.summaryContainer.querySelector('.summary-toolbar-container') as HTMLElement;
        if (!summaryToolbarContainer) {
            summaryToolbarContainer = this.summaryContainer.createDiv({
                cls: 'summary-toolbar-container'
            });
        }
        
        // Create toolbar with summary commands
        const toolbarContext = this.getCommandContext();
        this.plugin.toolbarService.createToolbar(summaryToolbarContainer, 'summary', toolbarContext);
        
        // Add an empty content message if there's no content
        if (!this.summaryContent) {
            const emptyContentEl = this.summaryContainer.createDiv({
                cls: 'empty-content-message'
            });
            emptyContentEl.setText('No summary yet. Click "Generate Summary" to create one.');
            emptyContentEl.style.textAlign = 'center';
            emptyContentEl.style.marginTop = '40px';
            emptyContentEl.style.color = 'var(--text-muted)';
            emptyContentEl.style.fontStyle = 'italic';
        }
    }
} 