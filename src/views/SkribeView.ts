import { ItemView, WorkspaceLeaf, setIcon, Notice, MarkdownRenderer, Menu, MenuItem } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';
import { AudioPlayer } from '../services/AudioPlayer';
import { ChatMessage, ChatState, CommandContext, SkribeState } from '../types/index';
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
    private isAtBottom: boolean = true;
    private scrollToBottomButton: HTMLElement | null = null;

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
        
        // Always set active tab to transcript for new content
        this.activeTab = 'transcript';
        
        // Save state when content is set
        this.saveState();
        
        this.refresh();
    }

    async onOpen() {
        // Check for saved state before refreshing the view
        const hasState = this.loadSavedState();
        
        if (!hasState) {
            // Only refresh directly if we don't have saved state
            this.refresh();
        }
        // If we loaded state, the refresh was already called in loadSavedState
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
            
            // Increase the max-width while keeping it responsive
            promptContainer.style.maxWidth = '440px';  // Reduced to match CSS
            promptContainer.style.width = '85%';  // Updated to match the new CSS value
            
            // Add logo image
            const logoContainer = promptContainer.createDiv({
                cls: 'empty-state-logo-container'
            });
            const logo = logoContainer.createEl('img', {
                cls: 'empty-state-logo',
                attr: {
                    src: getLogoPath(),
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
            inputContainer.style.maxWidth = '380px'; // Adjusted to match the reduced container size
            
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
            
            // Check if we're on mobile
            const isMobile = document.body.classList.contains('is-mobile') || 
                     document.documentElement.classList.contains('is-mobile') || 
                     document.documentElement.classList.contains('is-phone');
            
            if (isMobile) {
                // For mobile, use text instead of SVG icon
                getButton.textContent = '→';
            } else {
                // Add send icon for desktop
                setIcon(getButton, 'arrow-right');
            }
            
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

        // Create transcript container directly in the main container
        this.transcriptContainer = container.createDiv({
            cls: 'transcript-container'
        });
        
        // Create revised container
        this.revisedContainer = container.createDiv({
            cls: 'revised-container'
        });
        
        // Create summary container
        this.summaryContainer = container.createDiv({
            cls: 'summary-container'
        });

        // Create chat container
        this.chatContainer = container.createDiv({
            cls: 'chat-container'
        });
        
        // Set initial visibility based on active tab
        this.transcriptContainer.style.display = this.activeTab === 'transcript' ? 'block' : 'none';
        this.revisedContainer.style.display = this.activeTab === 'revised' ? 'block' : 'none';
        this.summaryContainer.style.display = this.activeTab === 'summary' ? 'block' : 'none';
        this.chatContainer.style.display = this.activeTab === 'chat' ? 'block' : 'none';

        // Always render transcript content if it exists
        await this.renderTranscriptToolbar();
        
        // Render active tab content if different from transcript
        if (this.activeTab === 'revised') {
            await this.renderRevisedToolbar();
            if (this.revisedContent) {
                await this.renderRevisedContent();
            }
        } else if (this.activeTab === 'summary') {
            await this.renderSummaryToolbar();
            if (this.summaryContent) {
                await this.renderSummaryContent();
            }
        } else if (this.activeTab === 'chat') {
            this.renderChatInterface();
        }
        
        // Ensure content is initialized for non-active tabs except transcript (already rendered)
        if (this.activeTab !== 'revised' && this.revisedContent) {
            // Create toolbar for revised tab even if not active
            await this.renderRevisedToolbar();
            await this.renderRevisedContent();
        }
        
        if (this.activeTab !== 'summary' && this.summaryContent) {
            // Create toolbar for summary tab even if not active
            await this.renderSummaryToolbar();
            await this.renderSummaryContent();
        }
        
        // Always add global chat input regardless of active tab
        this.createGlobalChatInput(container);
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
        });
        
        revisedTab.addEventListener('click', () => {
            this.switchToTab('revised');
        });
        
        summaryTab.addEventListener('click', () => {
            this.switchToTab('summary');
        });
        
        chatTab.addEventListener('click', () => {
            this.switchToTab('chat');
        });
    }
    
    private createTabItem(container: HTMLElement, text: string, isActive: boolean): HTMLElement {
        const tabId = text.toLowerCase();
        const tab = container.createDiv({
            cls: `tab-item ${isActive ? 'active' : ''}`,
            text: text,
            attr: {
                'data-tab': tabId
            }
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

    private async renderTranscriptToolbar() {
        this.transcriptContainer.empty();
        
        // Create transcript toolbar container
        const transcriptToolbarContainer = this.transcriptContainer.createDiv({
            cls: 'transcript-toolbar-container'
        });
        
        // Get fresh command context for the toolbar
        const toolbarContext = this.getCommandContext();
        
        // Create transcript toolbar with standard context
        this.plugin.toolbarService.createToolbar(transcriptToolbarContainer, 'transcript', toolbarContext);
        
        // Add model indicator to the toolbar
        const modelIndicator = transcriptToolbarContainer.createDiv({
            cls: 'model-indicator'
        });
        modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
        
        // Create content container - use consistent structure
        const transcriptContentEl = this.transcriptContainer.createDiv({
            cls: 'transcript-content'
        });
        
        // Set bottom padding to ensure content doesn't scroll under the chat input
        transcriptContentEl.style.paddingBottom = this.activeTab !== 'chat' ? '80px' : '0';
        
        // Add an empty content message if there's no content
        if (!this.content) {
            const emptyMessage = transcriptContentEl.createDiv({
                cls: 'empty-content-message',
                text: 'No transcript content yet. Enter a YouTube URL to get started.'
            });
        } else {
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
    }

    private renderChatInterface() {
        this.chatContainer.empty();
        
        // Create chat toolbar container
        const chatToolbarContainer = this.chatContainer.createDiv({
            cls: 'chat-toolbar-container'
        });
        
        // Get fresh command context for the toolbar
        const toolbarContext = this.getCommandContext();
        
        // Create chat toolbar with standard context - use 'chat' instead of 'transcript'
        this.plugin.toolbarService.createToolbar(chatToolbarContainer, 'chat', toolbarContext);
        
        // Add model indicator to the toolbar
        const modelIndicator = chatToolbarContainer.createDiv({
            cls: 'model-indicator'
        });
        modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
        
        // Create a single scrollable container for messages - use chat-content to match other tabs
        const chatContentEl = this.chatContainer.createDiv({
            cls: 'chat-content'
        });
        
        // Add chat messages
        this.renderChatMessages(chatContentEl);
        
        // Context menu handler to enable text selection
        const contextMenuHandler = (e: MouseEvent) => {
            // Only proceed if we're not trying to select text
            if (window.getSelection()?.toString() !== '') {
                return;
            }
        
            // Create a menu for the message
            const menu = new Menu();
            
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle("Copy Message")
                    .setIcon("copy")
                    .onClick(() => {
                        // Find closest message element
                        const messageEl = (e.target as HTMLElement).closest('.chat-message');
                        if (!messageEl) return;
                        
                        // Get text content
                        const text = messageEl.textContent;
                        if (!text) return;
                        
                        // Copy to clipboard
                        navigator.clipboard.writeText(text)
                            .then(() => {
                                new Notice('Message copied to clipboard');
                            })
                            .catch(err => {
                                console.error('Error copying message:', err);
                                new Notice('Failed to copy message');
                            });
                    });
            });
            
            menu.showAtMouseEvent(e);
        };
        
        // Add context menu handler to content container
        chatContentEl.addEventListener('contextmenu', contextMenuHandler);
        
        // Add scroll to bottom button (fixed to document body, not inside container)
        if (!this.scrollToBottomButton) {
            this.scrollToBottomButton = document.createElement('div');
            this.scrollToBottomButton.className = 'scroll-to-bottom-button hidden';
            
            // Check if we're on mobile
            const isMobile = document.body.classList.contains('is-mobile') || 
                      document.documentElement.classList.contains('is-mobile') || 
                      document.documentElement.classList.contains('is-phone');
            
            if (isMobile) {
                // For mobile, use text instead of SVG icon
                this.scrollToBottomButton.textContent = '↓';
            } else {
                // For desktop, use SVG icon
                this.scrollToBottomButton.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"></path></svg>';
            }
            
            document.body.appendChild(this.scrollToBottomButton);
            
            // Scroll button click handler
            this.scrollToBottomButton.addEventListener('click', (e: MouseEvent) => {
                this.scrollChatToBottom();
            });
        }
        
        // Scroll handler to check position
        const scrollHandler = (e: Event) => {
            this.checkScrollPosition(chatContentEl);
        };
        
        // Add scroll event listener
        chatContentEl.addEventListener('scroll', scrollHandler);
        
        // Add resize observer to update scroll button visibility when container resizes
        const resizeHandler = () => {
            this.checkScrollPosition(chatContentEl);
        };
        
        // Set up resize observer
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(resizeHandler);
            resizeObserver.observe(chatContentEl);
            
            // Store reference to disconnect later
            this.chatContainer.dataset.resizeObserverId = String(Math.random());
            (this as any)[`resizeObserver_${this.chatContainer.dataset.resizeObserverId}`] = resizeObserver;
        } else {
            // Fallback for browsers without ResizeObserver
            window.addEventListener('resize', resizeHandler);
            
            // Store reference to remove later
            this.chatContainer.dataset.hasResizeListener = 'true';
        }
        
        // Initialize scroll position check
        setTimeout(() => {
            this.checkScrollPosition(chatContentEl);
        }, 100);
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
                // Hide quips
                this.showQuips = false;
                dropdownMenu.style.display = 'none';
                
                // Remove active class from dropdown button
                const dropdownButton = document.querySelector('.split-button-dropdown') as HTMLElement;
                if (dropdownButton) {
                    dropdownButton.classList.remove('active');
                }
                
                // Use the helper method to switch to chat tab and process the message
                this.ensureChatInterfaceAndProcessMessage(quip);
            });
        });
    }

    private renderChatMessages(container: HTMLElement) {
        // Clear the container first
        container.empty();
        
        // Check if chat has any messages
        if (!this.chatState.messages || this.chatState.messages.length === 0) {
            // Show welcome message with quips if there are no messages
            if (this.showQuips && this.plugin.settings.quips && this.plugin.settings.quips.length > 0) {
                // Create quips cards
                this.renderQuipsCards(container);
            } else {
                // Show empty message
                container.createDiv({
                    cls: 'empty-chat-message',
                    text: this.getRandomWelcomeMessage()
                });
            }
            return;
        }

        // Display messages in sequential order
        this.chatState.messages.forEach(async (message, index) => {
            // Create message element with appropriate class
            const messageEl = container.createDiv({
                cls: `chat-message ${message.role}-message`
            });

            // Handle different message types
            if (message.role === 'user') {
                // User messages are typically plain text
                messageEl.setText(message.content);
            } else {
                // Assistant messages may contain markdown - render properly
                try {
                    await MarkdownRenderer.renderMarkdown(
                        message.content,
                        messageEl,
                        this.app.workspace.getActiveFile()?.path || '',
                        this
                    );
                    
                    // Ensure links open in a new tab
                    messageEl.querySelectorAll('a').forEach(a => {
                        a.setAttribute('target', '_blank');
                        a.setAttribute('rel', 'noopener noreferrer');
                    });
                } catch (error) {
                    console.error('Error rendering markdown in chat message:', error);
                    messageEl.setText(message.content); // Fallback to plain text
                }
            }
            
            // Add a clear fix after each message to ensure proper layout
            container.createDiv({
                cls: 'message-clearfix',
                attr: {
                    style: 'clear: both; width: 100%;'
                }
            });
        });
        
        // Check scroll position after rendering messages
        setTimeout(() => {
            this.checkScrollPosition(container);
            
            // Always scroll to bottom when first displaying messages
            if (container.scrollHeight > container.clientHeight) {
                container.scrollTop = container.scrollHeight;
            }
        }, 100);
    }
    
    // Helper method to process AI response
    private async processAIResponse(container: HTMLElement) {
        try {
            // Find the messages wrapper or create one if needed
            let messagesWrapper = container.querySelector('.chat-messages-wrapper');
            if (!messagesWrapper) {
                messagesWrapper = container.createDiv({
                    cls: 'chat-messages-wrapper'
                });
            }
            
            // Create a loading spinner message while waiting for the API response
            const loadingContainer = messagesWrapper.createDiv({
                cls: 'loading-spinner-container assistant-message'
            });
            
            const loadingSpinner = loadingContainer.createDiv({
                cls: 'loading-spinner'
            });
            
            const loadingMessage = loadingContainer.createDiv({
                cls: 'loading-message',
                text: 'Thinking...'
            });
            
            // Add clearfix after loading spinner
            messagesWrapper.createDiv({
                cls: 'message-clearfix',
                attr: {
                    style: 'clear: both; width: 100%;'
                }
            });
            
            // Scroll to show the loading spinner
            container.scrollTop = container.scrollHeight;
            this.isAtBottom = true;
            if (this.scrollToBottomButton) {
                this.hideScrollButton();
            }
            
            // Get AI response
            const response = await this.plugin.openaiService.chatWithTranscript(
                this.chatState.messages,
                this.content,
                this.videoTitle
            );
            
            // Remove the loading spinner
            loadingContainer.remove();
            
            // Add assistant message to chat
            this.chatState.messages.push({
                role: 'assistant',
                content: response
            });
            
            // Re-render chat messages from scratch to ensure correct order
            container.empty();
            this.renderChatMessages(container);
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
            this.isAtBottom = true;
            
            // Force check scroll position after adding AI message
            setTimeout(() => {
                this.checkScrollPosition(container);
            }, 100);
            
            if (this.scrollToBottomButton) {
                this.hideScrollButton();
                console.debug('[Skribe Debug] Hid scroll button after AI response');
            }
            
            // Update toolbar state after assistant message
            const chatToolbarContainer = this.chatContainer.querySelector('.chat-toolbar-container') as HTMLElement;
            if (chatToolbarContainer) {
                this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, this.getCommandContext());
            }
        } catch (error) {
            // Remove the loading spinner if it exists
            const loadingContainer = container.querySelector('.loading-spinner-container');
            if (loadingContainer) {
                loadingContainer.remove();
            }
            
            // Create an error message in the chat
            const errorContainer = container.createDiv({
                cls: 'chat-message assistant-message message-error'
            });
            
            errorContainer.setText(`Error: ${error.message || 'Failed to get a response'}`);
            
            // Show a notice as well
            new Notice('Failed to get response: ' + error.message);
            console.error('Chat Error:', error);
            
            // Scroll to show the error
            container.scrollTop = container.scrollHeight;
        }
        
        // Save state after adding AI response
        this.saveState();
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
        
        // Create summary toolbar container
        const summaryToolbarContainer = this.summaryContainer.createDiv({
            cls: 'summary-toolbar-container'
        });
        
        // Get fresh command context for the toolbar
        const toolbarContext = this.getCommandContext();
        
        // Create summary toolbar with standard context
        this.plugin.toolbarService.createToolbar(summaryToolbarContainer, 'summary', toolbarContext);
        
        // Add model indicator to the toolbar
        const modelIndicator = summaryToolbarContainer.createDiv({
            cls: 'model-indicator'
        });
        modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
        
        // Create content container - removed markdown-preview-view class
        const summaryContentContainer = this.summaryContainer.createDiv({
            cls: 'summary-content'
        });
        
        // Set bottom padding to ensure content doesn't scroll under the chat input
        summaryContentContainer.style.paddingBottom = this.activeTab !== 'chat' ? '80px' : '0';
        
        // Render markdown content
        await MarkdownRenderer.renderMarkdown(
            this.summaryContent,
            summaryContentContainer,
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
        
        // Save state when summary content changes
        this.saveState();
        
        // Switch to summary tab
        this.switchToTab('summary');
        
        // We need to completely refresh the summary container rather than the whole view
        this.summaryContainer.empty();
        
        try {
            // Create summary toolbar container
            const summaryToolbarContainer = this.summaryContainer.createDiv({
                cls: 'summary-toolbar-container'
            });
            
            // Get fresh command context for the toolbar
            const toolbarContext = this.getCommandContext();
            
            // Create summary toolbar with standard context
            this.plugin.toolbarService.createToolbar(summaryToolbarContainer, 'summary', toolbarContext);
            
            // Add model indicator to the toolbar
            const modelIndicator = summaryToolbarContainer.createDiv({
                cls: 'model-indicator'
            });
            modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
            
            // Create content container
            const summaryContentContainer = this.summaryContainer.createDiv({
                cls: 'summary-content'
            });
            
            // Set bottom padding to ensure content doesn't scroll under the chat input
            summaryContentContainer.style.paddingBottom = this.activeTab !== 'chat' ? '80px' : '0';
            
            // Render markdown content immediately
            MarkdownRenderer.renderMarkdown(
                this.summaryContent,
                summaryContentContainer,
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
    private switchToTab(tab: 'transcript' | 'revised' | 'summary' | 'chat') {
        // Update active tab state
        this.activeTab = tab;
        
        // Update container visibility
        if (this.transcriptContainer) {
            this.transcriptContainer.style.display = tab === 'transcript' ? 'block' : 'none';
        }
        
        if (this.revisedContainer) {
            this.revisedContainer.style.display = tab === 'revised' ? 'block' : 'none';
            
            // Only render revised toolbar if it's not already rendered
            if (tab === 'revised' && !this.revisedContent && 
                !this.revisedContainer.querySelector('.revised-toolbar-container')) {
                this.renderRevisedToolbar();
            }
        }
        
        if (this.summaryContainer) {
            this.summaryContainer.style.display = tab === 'summary' ? 'block' : 'none';
            
            // Only render summary toolbar if it's not already rendered
            if (tab === 'summary' && !this.summaryContent && 
                !this.summaryContainer.querySelector('.summary-toolbar-container')) {
                this.renderSummaryToolbar();
            }
        }
        
        if (this.chatContainer) {
            this.chatContainer.style.display = tab === 'chat' ? 'block' : 'none';
            
            // Special rendering for chat tab if needed
            if (tab === 'chat') {
                // Check if chat interface needs to be rendered
                const needsRendering = !this.chatContainer.querySelector('.chat-content');
                
                if (needsRendering) {
                    this.renderChatInterface();
                }
                
                // Check scroll position when switching to chat tab
                const chatContentEl = this.chatContainer.querySelector('.chat-content') as HTMLElement;
                if (chatContentEl) {
                    this.checkScrollPosition(chatContentEl);
                }
            }
        }
        
        // Manage global chat input
        // First, remove any existing global chat input
        const existingGlobalInput = this.containerEl.querySelector('.global-chat-input-container');
        if (existingGlobalInput) {
            existingGlobalInput.remove();
        }
        
        // Always add the global chat input regardless of active tab
        const mainContainer = this.containerEl.children[1] as HTMLElement;
        if (!mainContainer.querySelector('.global-chat-input-container')) {
            this.createGlobalChatInput(mainContainer);
        }
        
        // Update tab styles
        this.updateTabsUI();
        
        // Focus on the chat input after switching tabs, regardless of which tab is active
        // Use setTimeout to ensure the focus happens after the display changes and input is created
        setTimeout(() => {
            // Try the stored reference first
            if (this.chatInput) {
                this.chatInput.focus();
            } else {
                // Fallback to finding it in the DOM
                const chatInput = this.containerEl.querySelector('.chat-input') as HTMLInputElement;
                if (chatInput) {
                    chatInput.focus();
                }
            }
        }, 50);
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
        
        // Add model indicator to the toolbar
        const modelIndicator = revisedToolbarContainer.createDiv({
            cls: 'model-indicator'
        });
        modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
        
        // Create revised content div - removed markdown-preview-view class
        const revisedContentEl = this.revisedContainer.createDiv({
            cls: 'revised-content'
        });
        
        // Set bottom padding to ensure content doesn't scroll under the chat input
        revisedContentEl.style.paddingBottom = this.activeTab !== 'chat' ? '80px' : '0';
        
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
        
        // Save state when revised content changes
        this.saveState();
        
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
            
            // Add model indicator to the toolbar
            const modelIndicator = revisedToolbarContainer.createDiv({
                cls: 'model-indicator'
            });
            modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
            
            // Create revised content div
            const revisedContentEl = this.revisedContainer.createDiv({
                cls: 'revised-content'
            });
            
            // Set bottom padding to ensure content doesn't scroll under the chat input
            revisedContentEl.style.paddingBottom = this.activeTab !== 'chat' ? '80px' : '0';
            
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
        
        // Clear saved state
        if (this.plugin.settings.savedState) {
            this.plugin.settings.savedState = undefined;
            this.plugin.saveSettings();
        }
        
        // Refresh the view
        this.refresh();
    }

    /**
     * Obsidian lifecycle method called when the view is closed
     * Clean up resources and references
     */
    public onClose(): Promise<void> {
        console.log('SkribeView: onClose called');
        
        // Clean up references in the ToolbarService to prevent memory leaks
        if (this.plugin && this.plugin.toolbarService) {
            // Clean up view references for all toolbar types
            this.plugin.toolbarService.cleanupViewReferences('transcript');
            this.plugin.toolbarService.cleanupViewReferences('revised');
            this.plugin.toolbarService.cleanupViewReferences('summary');
            this.plugin.toolbarService.cleanupViewReferences('chat');
            
            console.log('SkribeView: Cleaned up view references in ToolbarService');
        }
        
        // Clean up scroll button if it exists
        if (this.scrollToBottomButton) {
            if (this.scrollToBottomButton.parentNode) {
                this.scrollToBottomButton.parentNode.removeChild(this.scrollToBottomButton);
            }
            this.scrollToBottomButton = null;
        }
        
        // Note: We don't need to manually remove event listeners or clear interval timers
        // as they are registered through Obsidian's register system and will be automatically cleaned up
        
        return Promise.resolve();
    }

    // Update existing clearChat method or add if not exists
    public clearChat() {
        this.chatState.messages = [];
        this.showQuips = true; // Show quips again when chat is cleared
        
        // Save state after clearing messages
        this.saveState();
        
        if (this.chatContainer) {
            const chatContentEl = this.chatContainer.querySelector('.chat-content') as HTMLElement;
            if (chatContentEl) {
                chatContentEl.empty();
                this.renderChatMessages(chatContentEl);
                
                // Reset scroll state
                this.isAtBottom = true;
                if (this.scrollToBottomButton) {
                    this.hideScrollButton();
                }
            }
            
            // Update toolbar state after clearing messages
            const chatToolbarContainer = this.chatContainer.querySelector('.chat-toolbar-container') as HTMLElement;
            if (chatToolbarContainer) {
                this.plugin.toolbarService.updateToolbarState(chatToolbarContainer, this.getCommandContext());
            }
        }
    }

    // Add a method to clear revised content
    public clearRevised() {
        this.revisedContent = '';
        // Save state after clearing content
        this.saveState();
        // Only re-render the revised container
        if (this.revisedContainer) {
            this.renderRevisedToolbar();
        }
    }

    // Add a method to clear summary content
    public clearSummary() {
        this.summaryContent = '';
        // Save state after clearing content
        this.saveState();
        // Only re-render the summary container
        if (this.summaryContainer) {
            this.renderSummaryToolbar();
        }
    }

    // New method to render just the Revised toolbar
    private async renderRevisedToolbar() {
        this.revisedContainer.empty();
        
        // Create revised toolbar container
        const revisedToolbarContainer = this.revisedContainer.createDiv({
            cls: 'revised-toolbar-container'
        });
        
        // Get fresh command context for the toolbar
        const toolbarContext = this.getCommandContext();
        
        // Create revised toolbar with standard context
        this.plugin.toolbarService.createToolbar(revisedToolbarContainer, 'revised', toolbarContext);
        
        // Add model indicator to the toolbar
        const modelIndicator = revisedToolbarContainer.createDiv({
            cls: 'model-indicator'
        });
        modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
        
        // Create content container - removed markdown-preview-view class
        const revisedContentContainer = this.revisedContainer.createDiv({
            cls: 'revised-content'
        });
        
        // Set bottom padding to ensure content doesn't scroll under the chat input
        revisedContentContainer.style.paddingBottom = this.activeTab !== 'chat' ? '80px' : '0';
        
        // Add an empty content message if there's no content
        if (!this.revisedContent) {
            const emptyMessage = revisedContentContainer.createDiv({
                cls: 'empty-content-message',
                text: 'No revised content yet. Use the "Create Revised Version" button to improve the transcript formatting and grammar.'
            });
        } else {
            // Render markdown content
            await MarkdownRenderer.renderMarkdown(
                this.revisedContent, 
                revisedContentContainer, 
                this.app.workspace.getActiveFile()?.path || '',
                this
            );
        }
    }
    
    // New method to render just the Summary toolbar
    private async renderSummaryToolbar() {
        this.summaryContainer.empty();
        
        // Create summary toolbar container
        const summaryToolbarContainer = this.summaryContainer.createDiv({
            cls: 'summary-toolbar-container'
        });
        
        // Get fresh command context for the toolbar
        const toolbarContext = this.getCommandContext();
        
        // Create summary toolbar with standard context
        this.plugin.toolbarService.createToolbar(summaryToolbarContainer, 'summary', toolbarContext);
        
        // Add model indicator to the toolbar
        const modelIndicator = summaryToolbarContainer.createDiv({
            cls: 'model-indicator'
        });
        modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
        
        // Create content container - removed markdown-preview-view class
        const summaryContentContainer = this.summaryContainer.createDiv({
            cls: 'summary-content'
        });
        
        // Set bottom padding to ensure content doesn't scroll under the chat input
        summaryContentContainer.style.paddingBottom = this.activeTab !== 'chat' ? '80px' : '0';
        
        // Add an empty content message if there's no content
        if (!this.summaryContent) {
            const emptyMessage = summaryContentContainer.createDiv({
                cls: 'empty-content-message',
                text: 'No summary content yet. Use the "Generate Summary" button to create a summary from the transcript.'
            });
        } else {
            // Render markdown content
            await MarkdownRenderer.renderMarkdown(
                this.summaryContent, 
                summaryContentContainer, 
                this.app.workspace.getActiveFile()?.path || '',
                this
            );
        }
    }

    // Update the renderQuipsCards method to auto-submit quips
    private renderQuipsCards(container: HTMLElement) {
        if (!this.plugin.settings.quips || this.plugin.settings.quips.length === 0) {
            return;
        }
        
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
            
            quipCard.addEventListener('click', async () => {
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
    }

    /**
     * Save the current state to settings for persistence
     */
    private saveState(): void {
        // Don't save state if there's no content
        if (!this.content) {
            return;
        }

        // Create state object
        const state: SkribeState = {
            content: this.content,
            videoUrl: this.videoUrl,
            videoTitle: this.videoTitle,
            revisedContent: this.revisedContent,
            summaryContent: this.summaryContent,
            chatState: this.chatState,
            activeTab: this.activeTab,
            lastUpdated: Date.now()
        };

        // Save state to settings
        this.plugin.settings.savedState = state;
        this.plugin.saveSettings();
        console.log('Skribe state saved', state);
    }

    /**
     * Load saved state from settings
     */
    public loadSavedState(): boolean {
        const savedState = this.plugin.settings.savedState;
        
        // Check if we have a saved state
        if (!savedState) {
            console.log('No saved state found in settings');
            return false;
        }
        
        // Validate if savedState has content (required field)
        if (!savedState.content) {
            console.log('Saved state exists but has no content, ignoring');
            return false;
        }
        
        console.log('%c[Skribe] Loading saved state from data.json', 'background: #4CAF50; color: white; padding: 5px; font-weight: bold;', {
            hasContent: !!savedState.content,
            contentLength: savedState.content.length,
            contentPreview: savedState.content.substring(0, 50) + '...',
            videoUrl: savedState.videoUrl,
            videoTitle: savedState.videoTitle?.substring(0, 30) + '...',
            activeTab: savedState.activeTab,
            hasRevisedContent: !!savedState.revisedContent,
            hasSummaryContent: !!savedState.summaryContent,
            chatMessagesCount: savedState.chatState?.messages?.length || 0,
            lastUpdated: new Date(savedState.lastUpdated).toLocaleString()
        });
        
        try {
            // Restore state
            this.content = savedState.content;
            this.videoUrl = savedState.videoUrl || '';
            this.videoTitle = savedState.videoTitle || '';
            this.revisedContent = savedState.revisedContent || '';
            this.summaryContent = savedState.summaryContent || '';
            this.chatState = savedState.chatState || { messages: [] };
            this.activeTab = savedState.activeTab || 'transcript';
            
            // Log what content was set
            console.log('%c[Skribe] State restored to memory', 'background: #2196F3; color: white; padding: 5px; font-weight: bold;', {
                contentLength: this.content.length,
                contentPreview: this.content.substring(0, 50) + '...',
                activeTab: this.activeTab
            });
            
            // Refresh the view with the restored state
            this.refresh();
            
            // Force update all toolbar states after refresh completes
            setTimeout(() => {
                this.updateAllToolbarStates();
                console.log('%c[Skribe] Toolbar states updated after restore', 'background: #FF9800; color: white; padding: 5px; font-weight: bold;');
            }, 100);
            
            console.log('%c[Skribe] View refreshed with restored state', 'background: #9C27B0; color: white; padding: 5px; font-weight: bold;');
            return true;
        } catch (error) {
            console.error('Error restoring saved state:', error);
            return false;
        }
    }

    /**
     * Update all toolbar states to ensure buttons are properly enabled/disabled
     * Called after loading state from data.json
     */
    private updateAllToolbarStates(): void {
        // Get fresh command context
        const context = this.getCommandContext();
        
        // Update each toolbar container if it exists
        const toolbarIds = ['transcript', 'revised', 'summary', 'chat'];
        
        toolbarIds.forEach(id => {
            const container = this.containerEl.querySelector(`.${id}-toolbar-container`) as HTMLElement;
            if (container) {
                this.plugin.toolbarService.updateToolbarState(container, context);
                console.log(`Updated toolbar state for: ${id}`);
            }
        });
    }

    // Helper to check if user is at bottom of chat and show/hide scroll button
    private checkScrollPosition(container: HTMLElement): void {
        // Ensure we have a valid container and scroll button
        if (!container || !this.scrollToBottomButton) {
            return;
        }
      
        // Calculate if we're at the bottom with a generous threshold
        const scrollRemaining = container.scrollHeight - container.scrollTop - container.clientHeight;
        const atBottom = scrollRemaining < 30; // Increased threshold for better UX
        
        // Only update if state has changed
        if (this.isAtBottom !== atBottom) {
            this.isAtBottom = atBottom;
            
            // Show/hide scroll button based on position
            if (atBottom) {
                this.hideScrollButton();
            } else {
                this.showScrollButton();
            }
        }
    }
    
    // Helper methods to show/hide scroll button with animation
    private showScrollButton(): void {
        if (!this.scrollToBottomButton) {
            // Create the button
            this.scrollToBottomButton = this.containerEl.createEl('button', {
                cls: 'scroll-to-bottom-button'
            });
            
            // Check if we're on mobile
            const isMobile = document.body.classList.contains('is-mobile') || 
                      document.documentElement.classList.contains('is-mobile') || 
                      document.documentElement.classList.contains('is-phone');
            
            if (isMobile) {
                // For mobile, use text instead of SVG icon
                this.scrollToBottomButton.textContent = '↓';
            } else {
                // For desktop, use SVG icon
                this.scrollToBottomButton.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"></path></svg>';
            }
            
            this.scrollToBottomButton.addEventListener('click', () => {
                this.scrollChatToBottom();
            });
        }
        
        // Show the button
        this.scrollToBottomButton.classList.remove('hidden');
    }
    
    private hideScrollButton(): void {
        if (!this.scrollToBottomButton) return;
        this.scrollToBottomButton.classList.add('hidden');
        this.scrollToBottomButton.style.display = 'none';
        this.scrollToBottomButton.style.pointerEvents = 'none';
    }
    
    // Helper to scroll chat to bottom
    private scrollChatToBottom(): void {
        // Find the chat messages container directly
        const chatContentEl = this.chatContainer.querySelector('.chat-content') as HTMLElement;
        if (!chatContentEl) return;
        
        // Use smooth scrolling for better UX
        chatContentEl.scrollTo({
            top: chatContentEl.scrollHeight,
            behavior: 'smooth'
        });
        
        this.isAtBottom = true;
        this.hideScrollButton();
    }

    // For debugging - adds the debug class to force scrolling
    public toggleDebugScrollable(): void {
        const chatContainer = this.chatContainer;
        if (!chatContainer) return;
        
        // Toggle the debug class
        chatContainer.classList.toggle('chat-debug-scrollable');
        
        // Get messages container
        const messagesContainer = chatContainer.querySelector('.chat-content') as HTMLElement;
        if (!messagesContainer) return;
        
        // Force check after toggling
        setTimeout(() => {
            // Force scroll to middle to test detection if debug mode is enabled
            if (chatContainer.classList.contains('chat-debug-scrollable')) {
                messagesContainer.scrollTop = 300;
            }
            this.checkScrollPosition(messagesContainer);
        }, 100);
        
        // Show notice about current state
        new Notice('Debug scroll mode ' + 
            (chatContainer.classList.contains('chat-debug-scrollable') ? 'enabled' : 'disabled'));
    }

    private async renderChatToolbar() {
        // Create toolbar container
        const toolbarContainer = this.chatContainer.createDiv({
            cls: 'chat-toolbar-container'
        });

        // Get toolbar items from the toolbar service
        this.plugin.toolbarService.createToolbar(
            toolbarContainer, 
            'chat', 
            this.getCommandContext()
        );
        
        // Add debug button 
        const debugButton = toolbarContainer.querySelector('.toolbar-container')?.createEl('button', {
            text: 'Debug Scroll',
            cls: 'debug-button',
            attr: {
                'aria-label': 'Debug scroll button',
                'title': 'Test scroll detection'
            }
        });
        
        if (debugButton) {
            debugButton.addEventListener('click', () => {
                // Find chat messages container
                const messagesContainer = this.chatContainer.querySelector('.chat-content') as HTMLElement;
                if (!messagesContainer) {
                    new Notice('Debug failed - no messages container found');
                    return;
                }
                
                // Force check scroll position
                if (this.scrollToBottomButton) {
                    // Toggle visibility directly for testing
                    if (this.scrollToBottomButton.style.display === 'none') {
                        this.scrollToBottomButton.style.display = 'flex';
                        this.scrollToBottomButton.style.opacity = '1';
                        this.scrollToBottomButton.style.visibility = 'visible';
                        new Notice('Scroll button shown for testing');
                    } else {
                        this.scrollToBottomButton.style.display = 'none';
                        new Notice('Scroll button hidden for testing');
                    }
                } else {
                    new Notice('Scroll button not found - check implementation');
                }
            });
        }
    }

    // Update tabs UI when switching tabs
    private updateTabsUI() {
        const tabsContainer = this.containerEl.querySelector('.tabs-container');
        if (!tabsContainer) return;
        
        const tabItems = tabsContainer.querySelectorAll('.tab-item');
        tabItems.forEach(tab => {
            const tabEl = tab as HTMLElement;
            const tabText = tabEl.textContent || '';
            if (tabText === this.capitalizeFirstLetter(this.activeTab)) {
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
     * Ensures the chat interface is properly initialized and processes a message
     * Used when submitting messages from the global chat input
     */
    private async ensureChatInterfaceAndProcessMessage(message: string) {
        // Add user message to chat state
        this.chatState.messages.push({
            role: 'user',
            content: message
        });
        
        // Switch to chat tab first
        this.switchToTab('chat');
        
        // Delay to allow the tab switch to complete
        setTimeout(async () => {
            // If we needed to refresh the view, the chat interface might not be ready yet
            if (!this.chatContainer) {
                await this.refresh();
            }
            
            // Now we can be sure the chat interface exists, render it
            this.renderChatInterface();
            
            // Get the chat messages container
            const chatContentEl = this.chatContainer?.querySelector('.chat-content') as HTMLElement;
            if (chatContentEl) {
                // Process AI response
                await this.processAIResponse(chatContentEl);
            } else {
                console.error('Chat messages container not found after refresh');
            }
        }, 100);
    }

    private createGlobalChatInput(container: HTMLElement) {
        // Create global chat input container at the bottom
        const globalChatInputContainer = container.createDiv({
            cls: 'global-chat-input-container'
        });
        
        // Create chat input
        const globalChatInput = globalChatInputContainer.createEl('input', {
            cls: 'chat-input',
            attr: {
                type: 'text',
                placeholder: 'Ask a question...'
            }
        });
        
        // Store a reference to the chat input
        this.chatInput = globalChatInput;
        
        // Create split button container
        const splitButtonContainer = globalChatInputContainer.createDiv({
            cls: 'split-button-container'
        });
        
        // Create main button part
        const sendButton = splitButtonContainer.createEl('button', {
            cls: 'split-button-main'
        });
        
        // Check if we're on mobile
        const isMobile = document.body.classList.contains('is-mobile') || 
                         document.documentElement.classList.contains('is-mobile') || 
                         document.documentElement.classList.contains('is-phone');
        
        if (isMobile) {
            // For mobile, use text instead of SVG icon
            sendButton.textContent = '↑';
        } else {
            // Desktop: Add send icon
            setIcon(sendButton, 'arrow-right');
        }
        
        // Create dropdown part
        const dropdownButton = splitButtonContainer.createEl('button', {
            cls: 'split-button-dropdown'
        });
        
        if (isMobile) {
            // For mobile, use text instead of SVG icon
            dropdownButton.textContent = '↓';
        } else {
            // Desktop: Add dropdown icon
            setIcon(dropdownButton, 'chevron-down');
        }
        
        // Create dropdown menu (initially hidden)
        const quipsDropdownMenu = container.createDiv({
            cls: 'quips-dropdown-menu'
        });
        quipsDropdownMenu.style.display = 'none';
        
        // Populate dropdown with quips
        this.populateQuipsDropdown(quipsDropdownMenu);
        
        // Toggle dropdown visibility
        dropdownButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle active class
            dropdownButton.classList.toggle('active');
            
            // Toggle dropdown visibility
            if (quipsDropdownMenu.style.display === 'none') {
                quipsDropdownMenu.style.display = 'block';
                // Add event listener to close when clicking outside
                document.addEventListener('click', closeDropdown);
            } else {
                quipsDropdownMenu.style.display = 'none';
                // Remove event listener when closing
                document.removeEventListener('click', closeDropdown);
            }
        });
        
        // Close dropdown when clicking outside
        const closeDropdown = (e: MouseEvent) => {
            if (!dropdownButton.contains(e.target as Node) && !quipsDropdownMenu.contains(e.target as Node)) {
                quipsDropdownMenu.style.display = 'none';
                dropdownButton.classList.remove('active');
                document.removeEventListener('click', closeDropdown);
            }
        };
        
        // Handle send button click
        const handleGlobalSend = async () => {
            const message = globalChatInput.value.trim();
            if (!message) return;
            
            // Clear input
            globalChatInput.value = '';
            
            // Hide quips when a message is sent
            this.showQuips = false;
            
            // Hide dropdown if it's open
            quipsDropdownMenu.style.display = 'none';
            dropdownButton.classList.remove('active');
            
            // Use the helper method to ensure chat interface and process message
            this.ensureChatInterfaceAndProcessMessage(message);
        };
        
        // Set up event listeners
        sendButton.addEventListener('click', handleGlobalSend);
        globalChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleGlobalSend();
            }
        });
    }
} 