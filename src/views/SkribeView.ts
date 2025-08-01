import { ItemView, WorkspaceLeaf, setIcon, Notice, MarkdownRenderer, Menu, MenuItem, MarkdownRenderChild } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';
import { AudioPlayer } from '../services/AudioPlayer';
import { ChatMessage, ChatState, CommandContext, SkribeState } from '../types/index';
import { getLogoPath } from '../utils/imageLoader';
import { URLInputModal } from '../ui/URLInputModal';

export const VIEW_TYPE_SKRIBE = "skribe-view";

export class SkribeView extends ItemView {
    content: string;
    videoUrl: string = '';
    videoTitle: string = '';
    plugin: SkribePlugin;
    contentEl: HTMLElement;
    activeTab: 'transcript' | 'revised' | 'summary' | 'chat' | 'chat-all' = 'transcript';
    revisedContent: string = '';
    revisedContents: { [index: number]: string } = {};
    summaryContent: string = '';
    summaryContents: { [index: number]: string } = {};
    chatState: ChatState = { messages: [] }; // Legacy for backward compatibility
    chatStates: { [index: number]: ChatState } = {};
    transcripts: { content: string, title: string, url: string }[] = [];
    activeTranscriptIndex: number = 0;
    transcriptContainer: HTMLElement;
    revisedContainer: HTMLElement;
    summaryContainer: HTMLElement;
    chatContainer: HTMLElement;
    chatContent: HTMLElement | null = null;
    chatMessages: ChatMessage[] = [];
    chatInput: HTMLInputElement | null = null;
    transcriptTabsContainer: HTMLElement | null = null;
    scrollToBottomButton: HTMLElement | null = null;
    scrollThreshold: number = 100; // Pixels from bottom to trigger auto-scroll
    isScrolledToBottom: boolean = true;
    audioPlayer: AudioPlayer | null = null;
    toolbarStates: { [key: string]: any } = {};
    welcomeMessages: string[] = [
        'Hello, Skribe!',
        'Hire a Skribe!',
        'Skribe something!'
    ];
    showQuips: boolean = true;
    isAtBottom: boolean = true;
    globalChatState: ChatState | null = null;
    globalChatContainer: HTMLElement | null = null;
    loadingContainer: HTMLElement | null = null;

    private getRandomWelcomeMessage(): string {
        const randomIndex = Math.floor(Math.random() * this.welcomeMessages.length);
        return this.welcomeMessages[randomIndex];
    }

    /**
     * Creates a welcome screen with logo, message, and input field
     * This is displayed when there are no transcripts
     */
    private createWelcomeScreen(container: HTMLElement): void {
        // Clear the container first
        container.empty();
        
        // Create center container for welcome screen
        const centerContainer = container.createDiv({
            cls: 'empty-state-center-container'
        });

        // Create container for welcome screen content
        const emptyStateContainer = centerContainer.createDiv({
            cls: 'empty-state-container'
        });

        // Add logo
        const logoContainer = emptyStateContainer.createDiv({
            cls: 'empty-state-logo-container'
        });
        
        // Create and set logo image
        const logoPath = getLogoPath();
        const logoImg = logoContainer.createEl('img', {
            cls: 'empty-state-logo',
            attr: {
                src: logoPath,
                alt: 'Skribe Logo'
            }
        });

        // Add welcome message
        const messageEl = emptyStateContainer.createDiv({
            cls: 'empty-state-message',
            text: this.getRandomWelcomeMessage()
        });

        // Add input container
        const inputContainer = emptyStateContainer.createDiv({
            cls: 'empty-state-input-container'
        });

        // Add URL input
        const urlInput = inputContainer.createEl('input', {
            cls: 'empty-state-url-input',
            attr: {
                type: 'text',
                placeholder: 'Enter YouTube URL or paste transcript content...'
            }
        });

        // Add submit button
        const submitButton = inputContainer.createEl('button', {
            cls: 'empty-state-get-button',
            text: ''
        });
        
        // Add icon to button
        setIcon(submitButton, 'arrow-right');

        // Add event listeners
        urlInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                this.handleUrlSubmit(urlInput.value);
            }
        });

        submitButton.addEventListener('click', () => {
            this.handleUrlSubmit(urlInput.value);
        });
    }

    // Add handleUrlSubmit method to process URL input
    private handleUrlSubmit(url: string): void {
        if (!url.trim()) {
            new Notice('Please enter a YouTube URL or paste transcript content');
            return;
        }

        // Use TranscriptManager to fetch transcript
        this.plugin.transcriptManager.fetchAndResetView(url);
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
            // No saved state, make sure we show the welcome screen
            console.log('No saved state found, showing welcome screen');
            this.resetView(); // Use resetView which properly sets up the welcome screen
        }
        // If we loaded state, the refresh was already called in loadSavedState
    }

    async refresh() {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        
        console.log(`Refreshing SkribeView with tab: ${this.activeTab}, transcript: ${this.activeTranscriptIndex}`);
        
        // Set up the view header
        this.createHeader(container);
        
        // Display the current video URL/title if it exists
        if (this.videoUrl || this.videoTitle) {
            this.createVideoUrlDisplay(container);
        }
        
        // Create the tabs
        this.createTabs(container);
        
        // Create containers for each tab content
        this.transcriptContainer = container.createDiv({
            cls: 'transcript-container'
        });
        
        this.revisedContainer = container.createDiv({
            cls: 'revised-container'
        });
        this.revisedContainer.style.display = 'none';
        
        this.summaryContainer = container.createDiv({
            cls: 'summary-container'
        });
        this.summaryContainer.style.display = 'none';
        
        this.chatContainer = container.createDiv({
            cls: 'chat-container'
        });
        this.chatContainer.style.display = 'none';
        
        this.globalChatContainer = container.createDiv({
            cls: 'global-chat-container chat-container'
        });
        this.globalChatContainer.style.display = 'none';
        
        // Add global chat container if it doesn't exist
        if (!this.globalChatContainer) {
            this.globalChatContainer = container.createDiv({
                cls: 'global-chat-container chat-container'
            });
        }
        
        // Set container visibility based on active tab
        this.transcriptContainer.style.display = this.activeTab === 'transcript' ? 'block' : 'none';
        this.revisedContainer.style.display = this.activeTab === 'revised' ? 'block' : 'none';
        this.summaryContainer.style.display = this.activeTab === 'summary' ? 'block' : 'none';
        this.chatContainer.style.display = this.activeTab === 'chat' ? 'block' : 'none';
        this.globalChatContainer.style.display = this.activeTab === 'chat-all' ? 'block' : 'none';
        
        // Check if we need to show the welcome screen (no content and no transcripts)
        if (this.transcripts.length === 0 && !this.content) {
            // Create welcome screen directly under transcript-container
            this.createWelcomeScreen(this.transcriptContainer);
            
            // Always add global chat input regardless of active tab
            this.createGlobalChatInput(container);
            
            return; // Exit early since we've handled the empty state
        }
        
        // Always render transcript content if it exists
        await this.renderTranscriptToolbar();
        
        // Render active tab content if different from transcript
        if (this.activeTab === 'revised') {
            await this.renderRevisedToolbar();
            // Get revised content for active transcript
            const hasRevisedContent = this.activeTranscriptIndex !== undefined && 
                                    this.revisedContents[this.activeTranscriptIndex];
            if (hasRevisedContent) {
                await this.renderRevisedContent();
            }
        } else if (this.activeTab === 'summary') {
            await this.renderSummaryToolbar();
            // Get summary content for active transcript
            const hasSummaryContent = this.activeTranscriptIndex !== undefined && 
                                    this.summaryContents[this.activeTranscriptIndex];
            if (hasSummaryContent) {
                await this.renderSummaryContent();
            }
        } else if (this.activeTab === 'chat') {
            this.renderChatInterface();
        } else if (this.activeTab === 'chat-all') {
            this.renderGlobalChatInterface();
        }
        
        // Ensure content is initialized for non-active tabs except transcript (already rendered)
        if (this.activeTab !== 'revised') {
            // Create toolbar for revised tab even if not active
            await this.renderRevisedToolbar();
            const hasRevisedContent = this.activeTranscriptIndex !== undefined && 
                                    this.revisedContents[this.activeTranscriptIndex];
            if (hasRevisedContent) {
                await this.renderRevisedContent();
            }
        }
        
        if (this.activeTab !== 'summary') {
            // Create toolbar for summary tab even if not active
            await this.renderSummaryToolbar();
            const hasSummaryContent = this.activeTranscriptIndex !== undefined && 
                                       this.summaryContents[this.activeTranscriptIndex];
            if (hasSummaryContent) {
                await this.renderSummaryContent();
            }
        }
        
        // Always add global chat input regardless of active tab
        this.createGlobalChatInput(container);
    }

    private createHeader(container: HTMLElement): HTMLElement {
        // Create a container for the header with proper styling
        const headerContainer = container.createDiv({
            cls: 'skribe-header'
        });
        
        // If we have transcripts, create the tabs in the header area
        if (this.transcripts.length > 0) {
            console.log('Creating transcript tabs in header for', this.transcripts.length, 'transcripts');
            
            // Create a div for the transcript tabs (without the "Video Transcripts:" label)
            const transcriptTabsDiv = headerContainer.createDiv({
                cls: 'transcript-tabs-row'
            });
            
            // Add each transcript as a tab
            this.transcripts.forEach((transcript, index) => {
                const isActive = index === this.activeTranscriptIndex;
                const tabTitle = transcript.title || `Video ${index + 1}`;
                console.log(`Creating tab for transcript ${index}: ${tabTitle}`);
                
                const tab = this.createTranscriptTabItem(transcriptTabsDiv, tabTitle, isActive, index);
                
                // Add click handler
                tab.addEventListener('click', (e) => {
                    // Only switch tabs if the click was not on the close button
                    if (!(e.target as HTMLElement).closest('.transcript-tab-close')) {
                        console.log(`Clicked on transcript tab ${index}`);
                        // Use TranscriptManager to switch tabs
                        this.plugin.transcriptManager.switchToTranscriptTab(index);
                    }
                });
            });
            
            // Add Chat All button (left of the add button)
            const chatAllButton = transcriptTabsDiv.createDiv({
                cls: 'chat-all-button',
                attr: {
                    'aria-label': 'Chat across all transcripts',
                    'title': 'Chat across all transcripts'
                }
            });
            chatAllButton.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"></path><path d="M7 9h10M7 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Chat All';
            
            // Add click handler for the Chat All button
            chatAllButton.addEventListener('click', () => {
                this.switchToGlobalChat();
            });
            
            // Add a "+" button to add a new transcript
            const addButton = transcriptTabsDiv.createDiv({
                cls: 'transcript-tab-add-button',
                attr: {
                    'aria-label': 'Add new transcript',
                    'title': 'Add new transcript'
                }
            });
            addButton.setText('+');
            
            // Add click handler for the add button
            addButton.addEventListener('click', () => {
                this.handleAddNewTranscript();
            });
            
            // Store the container reference so we can update it later
            this.transcriptTabsContainer = transcriptTabsDiv;
        } else {
            // If no transcripts yet, still create a container but just with the add button
            const transcriptTabsDiv = headerContainer.createDiv({
                cls: 'transcript-tabs-row'
            });
            
            // Add a "+" button to add a new transcript
            const addButton = transcriptTabsDiv.createDiv({
                cls: 'transcript-tab-add-button',
                attr: {
                    'aria-label': 'Add new transcript',
                    'title': 'Add new transcript'
                }
            });
            addButton.setText('+');
            
            // Add click handler for the add button
            addButton.addEventListener('click', () => {
                this.handleAddNewTranscript();
            });
            
            // Store the container reference
            this.transcriptTabsContainer = transcriptTabsDiv;
        }
        
        return headerContainer;
    }

    /**
     * Handler for when the add new transcript button is clicked
     */
    private handleAddNewTranscript() {
        // Use the URLInputModal to get a URL, then call the TranscriptManager directly
        new URLInputModal(this.app, (url: string) => {
            if (this.plugin.youtubeService.isYouTubeUrl(url)) {
                const videoId = this.plugin.youtubeService.extractVideoId(url);
                if (videoId) {
                    // Use the TranscriptManager to add without resetting
                    this.plugin.transcriptManager.fetchAndAddToExisting(url);
                } else {
                    new Notice('Could not extract video ID from the URL');
                }
            } else {
                new Notice('Invalid YouTube URL');
            }
        }).open();
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

        // Create wrapper for tabs on the left
        const tabsWrapper = tabsContainer.createDiv({
            cls: 'tabs-wrapper'
        });

        // Transcript tab
        const transcriptTab = this.createTabItem(tabsWrapper, 'Transcript', this.activeTab === 'transcript');
        
        // Revised tab
        const revisedTab = this.createTabItem(tabsWrapper, 'Revised', this.activeTab === 'revised');
        
        // Summary tab
        const summaryTab = this.createTabItem(tabsWrapper, 'Summary', this.activeTab === 'summary');
        
        // Chat tab
        const chatTab = this.createTabItem(tabsWrapper, 'Chat', this.activeTab === 'chat');
        
        // Create Start Over button on the right
        const startOverButton = tabsContainer.createEl('button', {
            cls: 'start-over-button',
            attr: {
                'aria-label': 'Start over',
                'data-command-id': 'start-over'
            }
        });
        
        // Add icon to button
        const startOverIcon = startOverButton.createSpan();
        setIcon(startOverIcon, 'rotate-ccw');
        
        // Add text to button
        startOverButton.createSpan({ text: 'Start Over' });
        
        // Add click handler to button
        startOverButton.addEventListener('click', async () => {
            try {
                // Confirm before resetting
                const confirmReset = confirm("Are you sure you want to start over? This will clear all transcripts and data.");
                
                if (confirmReset) {
                    if (typeof this.resetView === 'function') {
                        await this.resetView();
                        console.log('View reset successfully');
                    } else {
                        throw new Error('resetView method not found on view');
                    }
                } else {
                    console.log('Reset cancelled by user');
                }
            } catch (error) {
                console.error('Error resetting view:', error);
                new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
        
        // Add click handlers to tabs
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
        const tab = container.createDiv({
            cls: `tab-item ${isActive ? 'active' : ''}`,
            attr: {
                'data-tab-id': text.toLowerCase()
            }
        });
        tab.setText(text);
        
        // Add click handler to switch tabs
        tab.addEventListener('click', () => {
            // @ts-ignore: We've checked in the switch statement that it's a valid tab
            this.switchToTab(text.toLowerCase());
        });
        
        return tab;
    }

    private async renderTranscriptToolbar() {
        this.transcriptContainer.innerHTML = '';
        
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
        
        // Add class to adjust content positioning if we have transcript tabs
        if (this.transcripts.length > 0) {
            transcriptContentEl.addClass('with-transcript-tabs');
        }
        
        // Set bottom padding to ensure content doesn't scroll under the chat input
        transcriptContentEl.style.paddingBottom = this.activeTab !== 'chat' ? '80px' : '0';
        
        // If we have transcripts in the new format, render them
        if (this.transcripts.length > 0) {
            this.renderTranscriptContent();
        } 
        // Otherwise, render the legacy content
        else if (!this.content) {
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
        
        // Debounced scroll handler - declare timeout variable for later use with MutationObserver
        let scrollTimeout: NodeJS.Timeout | null = null;
        const scrollHandler = (e: Event) => {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.checkScrollPosition(chatContentEl);
                scrollTimeout = null;
            }, 50);
        };

        // Add scroll event listener
        chatContentEl.addEventListener('scroll', scrollHandler);

        // Use ResizeObserver for resize events
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

        // Use MutationObserver instead of DOMNodeInserted for more efficient DOM change detection
        if (typeof MutationObserver !== 'undefined') {
            const contentObserver = new MutationObserver((mutations) => {
                // Only check once after batched DOM changes
                if (scrollTimeout) clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    this.checkScrollPosition(chatContentEl);
                    scrollTimeout = null;
                }, 100);
            });
            
            // Observe content changes
            contentObserver.observe(chatContentEl, { childList: true, subtree: true });
            
            // Store reference to disconnect later
            this.chatContainer.dataset.mutationObserverId = String(Math.random());
            (this as any)[`mutationObserver_${this.chatContainer.dataset.mutationObserverId}`] = contentObserver;
        }

        // Progressive checking that stops after stable state - more efficient than multiple timeouts
        const checkAfterRender = (count = 0) => {
            this.checkScrollPosition(chatContentEl);
            
            // Only continue if container is still in DOM and we haven't checked too many times
            if (this.chatContainer.isConnected && count < 3) {
                setTimeout(() => checkAfterRender(count + 1), 300);
            }
        };

        // Initial check
        setTimeout(() => checkAfterRender(), 100);
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
        
        // Get the chat state for the active transcript
        const currentChatState = this.chatStates[this.activeTranscriptIndex] || { messages: [] };
        
        // Check if chat has any messages
        if (!currentChatState.messages || currentChatState.messages.length === 0) {
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
        currentChatState.messages.forEach(async (message, index) => {
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
        
        // Progressive check for scroll position instead of multiple timeouts
        const checkAfterMessagesRender = (count = 0) => {
            this.checkScrollPosition(container);
            
            // Always scroll to bottom when first displaying messages
            if (count === 0 && container.scrollHeight > container.clientHeight) {
                container.scrollTop = container.scrollHeight;
                this.isAtBottom = true;
            }
            
            // Only continue if container is still in DOM and we haven't checked too many times
            if (container.isConnected && count < 2) {
                setTimeout(() => checkAfterMessagesRender(count + 1), 250);
            }
        };
        
        // Start the progressive check
        setTimeout(() => checkAfterMessagesRender(), 100);
    }
    
    // Helper method to process AI response
    private async processAIResponse(container: HTMLElement) {
        try {
            // Get the current chat state for this transcript
            const currentChatState = this.chatStates[this.activeTranscriptIndex] || { messages: [] };
            
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
                currentChatState.messages,
                this.content,
                this.videoTitle
            );
            
            // Remove the loading spinner
            loadingContainer.remove();
            
            // Add assistant message to chat
            currentChatState.messages.push({
                role: 'assistant',
                content: response
            });
            
            // Update chat state in our transcript-specific storage
            this.chatStates[this.activeTranscriptIndex] = currentChatState;
            
            // Also update legacy chatState for backward compatibility
            this.chatState = currentChatState;
            
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
        
        // Get summary content for the active transcript
        const summaryContent = this.summaryContents[this.activeTranscriptIndex] || '';
        
        if (!summaryContent) {
            // Show empty state message if no summary content for this transcript
            const emptyMessage = summaryContentContainer.createDiv({
                cls: 'empty-content-message'
            });
            emptyMessage.textContent = `No summary content for this transcript yet. Click "Generate Summary" in the toolbar to create one.`;
            return;
        }
        
        // Render markdown content
        await MarkdownRenderer.renderMarkdown(
            summaryContent,
            summaryContentContainer,
            this.app.workspace.getActiveFile()?.path || '',
            this
        );
    }
    
    public setSummaryContent(content: string) {
        console.log('SkribeView: setSummaryContent called', {
            contentLength: content?.length,
            activeTabBefore: this.activeTab,
            activeTranscriptIndex: this.activeTranscriptIndex
        });
        
        if (!content) {
            console.error('SkribeView: Empty content provided to setSummaryContent');
            new Notice('Cannot display empty summary');
            return;
        }
        
        // Store the summary content for the active transcript
        this.summaryContents[this.activeTranscriptIndex] = content;
        
        // Also update the legacy property for backward compatibility
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
                content, // Use the content directly since we just received it
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
    private switchToTab(tab: 'transcript' | 'revised' | 'summary' | 'chat' | 'chat-all') {
        // Update active tab state
        this.activeTab = tab;
        
        // Update container visibility
        if (this.transcriptContainer) {
            this.transcriptContainer.style.display = tab === 'transcript' ? 'block' : 'none';
        }
        
        if (this.revisedContainer) {
            this.revisedContainer.style.display = tab === 'revised' ? 'block' : 'none';
            
            // Check for revised content in the active transcript
            const hasRevisedContent = this.activeTranscriptIndex !== undefined && 
                                       this.revisedContents[this.activeTranscriptIndex];
            
            // Only render revised toolbar if it's not already rendered
            if (tab === 'revised' && !hasRevisedContent && 
                !this.revisedContainer.querySelector('.revised-toolbar-container')) {
                this.renderRevisedToolbar();
            }
        }
        
        if (this.summaryContainer) {
            this.summaryContainer.style.display = tab === 'summary' ? 'block' : 'none';
            
            // Check for summary content in the active transcript
            const hasSummaryContent = this.activeTranscriptIndex !== undefined && 
                                       this.summaryContents[this.activeTranscriptIndex];
            
            // Only render summary toolbar if it's not already rendered
            if (tab === 'summary' && !hasSummaryContent && 
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
        
        // Save the state after switching tabs
        this.saveState();
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
        // Get the current chat state for the active transcript
        const currentChatState = this.chatStates[this.activeTranscriptIndex] || { messages: [] };
        
        // Create a fresh context object for toolbar commands
        const context: CommandContext = {
            plugin: this.plugin,
            view: this,
            content: this.content,
            videoUrl: this.videoUrl,
            videoTitle: this.videoTitle,
            activeTab: this.activeTab,
            chatMessages: currentChatState.messages || [],
            chatState: currentChatState,
            chatStates: this.chatStates,
            summaryContent: this.summaryContents[this.activeTranscriptIndex] || '',
            revisedContent: this.revisedContents[this.activeTranscriptIndex] || '',
            revisedContents: this.revisedContents,
            summaryContents: this.summaryContents,
            activeTranscriptIndex: this.activeTranscriptIndex,
            transcripts: this.transcripts,
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
        
        // Get the revised content for the active transcript
        const revisedContent = this.revisedContents[this.activeTranscriptIndex] || '';
        
        if (!revisedContent) {
            // Show empty state message if no revised content for this transcript
            const emptyMessage = revisedContentEl.createDiv({
                cls: 'empty-content-message'
            });
            emptyMessage.textContent = `No revised content for this transcript yet. Click "Revise" in the toolbar to create one.`;
            return;
        }
        
        // Render markdown content
        await MarkdownRenderer.renderMarkdown(
            revisedContent,
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
            activeTabBefore: this.activeTab,
            activeTranscriptIndex: this.activeTranscriptIndex
        });
        
        if (!content) {
            console.error('SkribeView: Empty content provided to setRevisedContent');
            new Notice('Cannot display empty revised content');
            return;
        }
        
        // Store the revised content for the active transcript
        this.revisedContents[this.activeTranscriptIndex] = content;
        
        // Also update the legacy property for backward compatibility
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
                content, // Use the content directly since we just received it
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
        
        if (!this.content || this.transcripts.length === 0) {
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
            // Get the active transcript's content
            const activeTranscript = this.transcripts[this.activeTranscriptIndex];
            if (!activeTranscript) {
                throw new Error('No active transcript found');
            }
            
            console.log('SkribeView: Creating revised content for transcript with length:', activeTranscript.content.length);
            
            // Use the specialized method for creating revised transcripts
            const revisedContent = await this.plugin.openaiService.createRevisedTranscript(activeTranscript.content);
            
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
        console.log('Resetting view completely');
        
        // Reset all content
        this.content = '';
        this.videoUrl = '';
        this.videoTitle = '';
        this.summaryContent = '';
        this.revisedContent = '';  // Keep for backward compatibility
        this.revisedContents = {} as { [index: number]: string }; // Clear with properly typed empty object
        this.chatState = { messages: [] };
        this.showQuips = true; // Reset the showQuips flag
        
        // Clear transcripts array
        this.transcripts = [];
        this.activeTranscriptIndex = 0;
        this.transcriptTabsContainer = null;
        
        // Switch back to transcript tab 
        this.activeTab = 'transcript';
        
        // Clear saved state
        if (this.plugin.settings.savedState) {
            this.plugin.settings.savedState = undefined;
            this.plugin.saveSettings();
        }
        
        // Get the main container
        const mainContainer = this.containerEl.children[1] as HTMLElement;
        
        // Completely clear everything to ensure a fresh start
        mainContainer.empty();
        
        // Create a completely new transcript container
        this.transcriptContainer = mainContainer.createDiv({
            cls: 'transcript-container'
        });
        
        // Ensure the container is visible
        this.transcriptContainer.style.display = 'block';
        
        // Create the other containers (but don't display them)
        this.revisedContainer = mainContainer.createDiv({
            cls: 'revised-container'
        });
        this.revisedContainer.style.display = 'none';
        
        this.summaryContainer = mainContainer.createDiv({
            cls: 'summary-container'
        });
        this.summaryContainer.style.display = 'none';
        
        this.chatContainer = mainContainer.createDiv({
            cls: 'chat-container'
        });
        this.chatContainer.style.display = 'none';
        
        this.globalChatContainer = mainContainer.createDiv({
            cls: 'global-chat-container chat-container'
        });
        this.globalChatContainer.style.display = 'none';
        
        // Create a placeholder for transcript content (will be empty)
        const transcriptContentEl = this.transcriptContainer.createDiv({
            cls: 'transcript-content'
        });
        
        // Create the welcome screen directly under transcript-container
        this.createWelcomeScreen(this.transcriptContainer);
        
        console.log('View reset to welcome screen');
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
        
        // Clean up any MutationObservers
        if (this.chatContainer) {
            // Clean up MutationObserver if one was created
            if (this.chatContainer.dataset.mutationObserverId) {
                const observerId = this.chatContainer.dataset.mutationObserverId;
                const observer = (this as any)[`mutationObserver_${observerId}`];
                if (observer) {
                    observer.disconnect();
                    delete (this as any)[`mutationObserver_${observerId}`];
                }
            }
            
            // Clean up ResizeObserver if one was created
            if (this.chatContainer.dataset.resizeObserverId) {
                const observerId = this.chatContainer.dataset.resizeObserverId;
                const observer = (this as any)[`resizeObserver_${observerId}`];
                if (observer) {
                    observer.disconnect();
                    delete (this as any)[`resizeObserver_${observerId}`];
                }
            }
            
            // Remove resize event listener if added
            if (this.chatContainer.dataset.hasResizeListener === 'true') {
                window.removeEventListener('resize', this.checkScrollPosition.bind(this));
            }
        }
        
        // Note: We don't need to manually remove all event listeners
        // as they are registered through Obsidian's register system and will be automatically cleaned up
        
        return Promise.resolve();
    }

    // Update existing clearChat method or add if not exists
    public clearChat() {
        // Clear chat messages for the active transcript
        if (this.activeTranscriptIndex !== undefined) {
            this.chatStates[this.activeTranscriptIndex] = { messages: [] };
        }
        
        // Also clear the legacy chatState property
        this.chatState = { messages: [] };
        
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
        // Clear revised content for the active transcript
        if (this.activeTranscriptIndex !== undefined) {
            delete this.revisedContents[this.activeTranscriptIndex];
        }
        
        // Also clear the legacy property
        this.revisedContent = '';
        
        // Re-render the revised content (which will show the empty state)
        this.renderRevisedContent();
        
        // Save the updated state
        this.saveState();
    }

    // Add a method to clear summary content
    public clearSummary() {
        // Clear summary content for the active transcript
        if (this.activeTranscriptIndex !== undefined) {
            delete this.summaryContents[this.activeTranscriptIndex];
        }
        
        // Also clear the legacy property
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
        
        // Get the revised content for the active transcript
        const revisedContent = this.revisedContents[this.activeTranscriptIndex] || '';
        
        // Add an empty content message if there's no content
        if (!revisedContent) {
            const emptyMessage = revisedContentContainer.createDiv({
                cls: 'empty-content-message',
                text: 'No revised content yet for the selected transcript. Use the "Create Revised Version" button to improve the transcript formatting and grammar.'
            });
        } else {
            // Render markdown content
            await MarkdownRenderer.renderMarkdown(
                revisedContent, 
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
        
        // Get the summary content for the active transcript
        const summaryContent = this.summaryContents[this.activeTranscriptIndex] || '';
        
        // Add an empty content message if there's no content
        if (!summaryContent) {
            const emptyMessage = summaryContentContainer.createDiv({
                cls: 'empty-content-message',
                text: 'No summary content yet. Use the "Generate Summary" button to create a summary from the transcript.'
            });
        } else {
            // Render markdown content
            await MarkdownRenderer.renderMarkdown(
                summaryContent, 
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
            revisedContents: this.revisedContents,
            summaryContents: this.summaryContents,
            chatStates: this.chatStates,
            summaryContent: this.summaryContent, // Keep for backward compatibility
            chatState: this.chatState, // Keep for backward compatibility
            globalChatState: this.globalChatState || { messages: [] }, // Save global chat state
            activeTab: this.activeTab,
            transcripts: this.transcripts,
            activeTranscriptIndex: this.activeTranscriptIndex,
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
        
        if (!savedState) {
            console.log('No saved state found, starting fresh');
            return false;
        }
        
        console.log('Found saved state, restoring');
        console.log('Last updated:', new Date(savedState.lastUpdated || 0).toLocaleString());
        
        // Validate if we have content to restore
        if (!savedState.content && (!savedState.transcripts || savedState.transcripts.length === 0)) {
            console.log('Saved state has no content or transcripts, skipping restore');
            return false;
        }
        
        try {
            // Restore state
            this.content = savedState.content || '';
            this.videoUrl = savedState.videoUrl || '';
            this.videoTitle = savedState.videoTitle || '';
            this.revisedContents = savedState.revisedContents || {} as { [index: number]: string };
            this.summaryContents = savedState.summaryContents || {} as { [index: number]: string };
            this.chatStates = savedState.chatStates || {} as { [index: number]: ChatState };
            this.summaryContent = savedState.summaryContent || '';
            this.chatState = savedState.chatState || { messages: [] };
            this.globalChatState = savedState.globalChatState || { messages: [] }; // Restore global chat state
            this.activeTab = savedState.activeTab || 'transcript';
            this.transcripts = savedState.transcripts || [];
            this.activeTranscriptIndex = savedState.activeTranscriptIndex || 0;
            
            // For backwards compatibility with older versions
            const typedState = savedState as SkribeState & {
                revisedContent?: string;
                summaryContent?: string;
                chatState?: ChatState;
            };
            
            // Check for legacy revisedContent
            if (typedState.revisedContent && typeof typedState.revisedContent === 'string') {
                if (this.activeTranscriptIndex !== undefined) {
                    this.revisedContents[this.activeTranscriptIndex] = typedState.revisedContent;
                }
                // Also keep the legacy field in case it's needed
                this.revisedContent = typedState.revisedContent;
            }
            
            // Check for legacy summaryContent
            if (typedState.summaryContent && typeof typedState.summaryContent === 'string') {
                if (this.activeTranscriptIndex !== undefined && !this.summaryContents[this.activeTranscriptIndex]) {
                    this.summaryContents[this.activeTranscriptIndex] = typedState.summaryContent;
                }
            }
            
            // Check for legacy chatState
            if (typedState.chatState && !this.chatStates[this.activeTranscriptIndex]) {
                this.chatStates[this.activeTranscriptIndex] = typedState.chatState;
            }
            
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
            
            return true;
        } catch (error) {
            console.error('Error restoring state:', error);
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
        // Ensure we have a valid container
        if (!container) {
            return;
        }
    
        // Calculate if we're at the bottom with a generous threshold
        const scrollRemaining = container.scrollHeight - container.scrollTop - container.clientHeight;
        const atBottom = scrollRemaining < 30; // Increased threshold for better UX
        
        console.log('Scroll check:', { 
            scrollHeight: container.scrollHeight,
            scrollTop: container.scrollTop,
            clientHeight: container.clientHeight,
            scrollRemaining, 
            atBottom 
        });
        
        // Only update if state has changed or scrollToBottomButton is not properly initialized
        if (this.isAtBottom !== atBottom || !this.scrollToBottomButton) {
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
        // Always recreate the button each time to ensure proper visibility
        if (this.scrollToBottomButton) {
            this.scrollToBottomButton.remove();
        }
        
        // Create the button directly on document body for highest z-index
        this.scrollToBottomButton = document.createElement('div');
        this.scrollToBottomButton.className = 'scroll-to-bottom-button';
        
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
        
        // Remove 'hidden' class and ensure button is displayed properly
        this.scrollToBottomButton.classList.remove('hidden');
        this.scrollToBottomButton.style.display = 'flex';
        this.scrollToBottomButton.style.visibility = 'visible';
        this.scrollToBottomButton.style.opacity = '1';
    }
    
    private hideScrollButton(): void {
        if (!this.scrollToBottomButton) return;
        this.scrollToBottomButton.classList.add('hidden');
        
        // Use a setTimeout to ensure the animation completes before fully hiding the button
        setTimeout(() => {
            if (this.scrollToBottomButton) {
                this.scrollToBottomButton.style.display = 'none';
                this.scrollToBottomButton.style.pointerEvents = 'none';
            }
        }, 150);
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
        // Find all tab items
        const tabItems = this.containerEl.querySelectorAll('.tab-item');
        
        // Update tab active state
        tabItems.forEach(item => {
            const tabEl = item as HTMLElement;
            const tabId = tabEl.getAttribute('data-tab-id');
            
            if (tabId === this.activeTab) {
                tabEl.classList.add('active');
            } else {
                tabEl.classList.remove('active');
            }
        });
        
        // In case a tab doesn't exist in the UI (like chat-all), handle it properly
        if (this.activeTab === 'chat-all') {
            // Make sure none of the standard tabs are highlighted
            tabItems.forEach(item => {
                item.classList.remove('active');
            });
        }
    }

    /**
     * Ensures the chat interface is properly initialized and processes a message
     * Used when submitting messages from the global chat input
     */
    private async ensureChatInterfaceAndProcessMessage(message: string) {
        // Check if we're in global chat mode
        if (this.activeTab === 'chat-all') {
            // Initialize global chat state if it doesn't exist
            if (!this.globalChatState) {
                this.globalChatState = { messages: [] };
            }
            
            // Add user message to global chat state
            this.globalChatState.messages.push({
                role: 'user',
                content: message
            });
            
            // Save state
            this.saveState();
            
            // Make sure the global chat interface is rendered
            this.renderGlobalChatInterface();
            
            // Get the chat messages container
            const chatContentEl = this.globalChatContainer?.querySelector('.chat-content') as HTMLElement;
            if (chatContentEl) {
                // Process AI response for global chat
                await this.processGlobalAIResponse(chatContentEl);
            } else {
                console.error('Global chat messages container not found');
            }
            
            return;
        }
        
        // Regular transcript-specific chat handling
        // Get the current chat state for this transcript
        let currentChatState = this.chatStates[this.activeTranscriptIndex];
        if (!currentChatState) {
            currentChatState = { messages: [] };
            this.chatStates[this.activeTranscriptIndex] = currentChatState;
        }
        
        // Add user message to chat state
        currentChatState.messages.push({
            role: 'user',
            content: message
        });
        
        // Update legacy chatState for backward compatibility
        this.chatState = currentChatState;
        
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

    // Add a method to clear the global chat
    public clearGlobalChat() {
        // Reset global chat messages
        this.globalChatState = { messages: [] };
        
        // Save state
        this.saveState();
        
        // Re-render the global chat interface
        this.renderGlobalChatInterface();
    }

    private createGlobalChatInput(container: HTMLElement) {
        // Create global chat input container at the bottom
        const chatInputContainer = container.createDiv({
            cls: 'global-chat-input-container'
        });
        
        // Create chat input
        const globalChatInput = chatInputContainer.createEl('input', {
            cls: 'chat-input',
            attr: {
                type: 'text',
                placeholder: this.activeTab === 'chat-all' ? 'Ask about all transcripts...' : 'Ask about this transcript...',
                'aria-label': 'Chat input'
            }
        });
        
        // Store reference to chat input
        this.chatInput = globalChatInput;
        
        // Create send button container
        const splitButtonContainer = chatInputContainer.createDiv({
            cls: 'split-button-container'
        });
        
        // Create send button
        const sendButton = splitButtonContainer.createEl('button', {
            cls: 'split-button-main'
        });
        sendButton.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2,21L23,12L2,3V10L17,12L2,14V21Z" /></svg>';
        
        // Create dropdown button for quips
        const dropdownButton = splitButtonContainer.createEl('button', {
            cls: 'split-button-dropdown'
        });
        dropdownButton.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7,10L12,15L17,10H7Z" /></svg>';
        
        // Create quips dropdown menu
        const quipsDropdownMenu = document.createElement('div');
        quipsDropdownMenu.className = 'quips-dropdown-menu';
        quipsDropdownMenu.style.display = 'none';
        document.body.appendChild(quipsDropdownMenu);
        
        // Toggle dropdown when clicking the dropdown button
        
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

    public addSeparator() {
        const separator = this.contentEl.createDiv({
            cls: 'transcript-separator'
        });
        this.transcriptContainer.appendChild(separator);
    }

    // Add the addTranscript method after the addSeparator method
    public addTranscript(content: string, url: string, title: string) {
        console.log(`Adding transcript: "${title}" (${content.length} characters)`);
        
        // Track if this is the first transcript being added
        const isFirstTranscript = this.transcripts.length === 0;
        
        // Add the transcript to the collection
        this.transcripts.push({
            content,
            url,
            title
        });
        
        // Update the combined content for backward compatibility using TranscriptManager
        this.plugin.transcriptManager.updateCombinedContent(this);
        
        // If this is the first transcript, set it as active
        if (isFirstTranscript) {
            this.activeTranscriptIndex = 0;
        }
        
        // Save state when transcripts change
        this.saveState();
        
        // Refresh the view if this is our first transcript 
        // OR if we need to update the tabs in the header
        if (isFirstTranscript || this.transcripts.length > 1) {
            this.refresh();
        }
        
        console.log(`Total transcripts: ${this.transcripts.length}`);
    }

    // Add the updateCombinedContent method
    private updateCombinedContent() {
        this.content = this.transcripts.map((t, index) => {
            const header = index === 0 ? '' : `\n\n${'='.repeat(40)}\n${t.title || 'Video ' + (index + 1)}\n${'='.repeat(40)}\n\n`;
            return header + t.content;
        }).join('');
    }

    /**
     * Switch to a specific transcript tab
     */
    public switchToTranscriptTab(index: number) {
        if (index < 0 || index >= this.transcripts.length) {
            console.error(`Invalid transcript index: ${index}, max is ${this.transcripts.length - 1}`);
            return;
        }

        console.log(`Switching to transcript tab ${index} of ${this.transcripts.length - 1}`);
        
        // Update the active index
        this.activeTranscriptIndex = index;
        
        // Update UI to reflect the active tab
        this.updateTranscriptTabsUI();
        
        // Update the main content with the selected transcript
        this.content = this.transcripts[index].content;
        
        // Update URL and title for the active transcript
        this.videoUrl = this.transcripts[index].url;
        this.videoTitle = this.transcripts[index].title;
        
        // Update the video URL display
        const urlContainer = this.containerEl.querySelector('.video-url-container');
        if (urlContainer) {
            const titleEl = urlContainer.querySelector('.video-title');
            const linkEl = urlContainer.querySelector('.video-url-link');
            
            if (titleEl) {
                titleEl.textContent = this.videoTitle;
            }
            
            if (linkEl) {
                (linkEl as HTMLAnchorElement).href = this.videoUrl;
                linkEl.textContent = this.videoUrl;
            }
        }
        
        // Also update the legacy revisedContent property for backward compatibility
        this.revisedContent = this.revisedContents[index] || '';
        
        // Also update the legacy summaryContent property for backward compatibility
        this.summaryContent = this.summaryContents[index] || '';
        
        // Also update the legacy chatState property for backward compatibility
        this.chatState = this.chatStates[index] || { messages: [] };
        
        // Re-render the current tab's content
        this.renderTranscriptContent();
        
        // If we're on the revised tab, re-render that too
        if (this.activeTab === 'revised') {
            this.renderRevisedContent();
        }
        
        // If we're on the summary tab, re-render that too
        if (this.activeTab === 'summary') {
            this.renderSummaryContent();
        }
        
        // If we're on the chat tab, re-render that too
        if (this.activeTab === 'chat') {
            this.renderChatInterface();
        }
        
        // Save the state after switching
        this.saveState();
    }

    // Add the createTranscriptTabs method
    private createTranscriptTabs(container: HTMLElement) {
        // Create tabs container if it doesn't exist
        if (this.transcriptTabsContainer) {
            this.transcriptTabsContainer.remove();
        }
        
        // Create transcript tabs container as a child of the provided container
        this.transcriptTabsContainer = container.createDiv({
            cls: 'transcript-tabs-row'
        });
        
        // Add transcript tabs
        this.transcripts.forEach((transcript, index) => {
            const isActive = index === this.activeTranscriptIndex;
            const tabTitle = transcript.title || `Video ${index + 1}`;
            const transcriptTab = this.createTranscriptTabItem(this.transcriptTabsContainer!, tabTitle, isActive, index);
            
            // Add click handler to the tab itself
            transcriptTab.addEventListener('click', (e) => {
                // Only switch tabs if the click was on the tab and not on the close button
                if (!(e.target as HTMLElement).closest('.transcript-tab-close')) {
                    // Use TranscriptManager to switch tabs
                    this.plugin.transcriptManager.switchToTranscriptTab(index);
                }
            });
        });
        
        // Add Chat All button (left of the add button)
        const chatAllButton = this.transcriptTabsContainer.createDiv({
            cls: 'chat-all-button',
            attr: {
                'aria-label': 'Chat across all transcripts',
                'title': 'Chat across all transcripts'
            }
        });
        chatAllButton.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"></path><path d="M7 9h10M7 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg> Chat All';
        
        // Add click handler for the Chat All button
        chatAllButton.addEventListener('click', () => {
            this.switchToGlobalChat();
        });
        
        // Add a "+" button to add a new transcript
        const addButton = this.transcriptTabsContainer.createDiv({
            cls: 'transcript-tab-add-button',
            attr: {
                'aria-label': 'Add new transcript',
                'title': 'Add new transcript'
            }
        });
        addButton.setText('+');
        
        // Add click handler for the add button
        addButton.addEventListener('click', () => {
            this.handleAddNewTranscript();
        });
        
        return this.transcriptTabsContainer;
    }

    // Add the createTranscriptTabItem method
    private createTranscriptTabItem(container: HTMLElement, text: string, isActive: boolean, index: number): HTMLElement {
        // Ensure we have a fallback title if text is empty
        const tabTitle = text ? text : `Video ${index + 1}`;
        
        // Create the tab with proper styling
        const tab = container.createDiv({
            cls: `transcript-tab-item ${isActive ? 'active' : ''}`,
            attr: {
                'data-index': index.toString(),
                'title': tabTitle // Full title as tooltip
            }
        });
        
        // Create a wrapper for the text to allow for close button
        const tabTextWrapper = tab.createDiv({
            cls: 'transcript-tab-text'
        });
        
        // For better visibility, include the index for multiple tabs
        // Use longer titles now that we have more space
        let displayText = '';
        if (this.transcripts.length > 1) {
            // With many tabs, still be somewhat concise
            if (this.transcripts.length > 5) {
                displayText = `#${index + 1}`;
                if (tabTitle.length > 15) {
                    displayText += `: ${tabTitle.substring(0, 15)}...`;
                } else {
                    displayText += `: ${tabTitle}`;
                }
            } else {
                // With fewer tabs, show more text
                displayText = `#${index + 1}: ${tabTitle.length > 20 ? tabTitle.substring(0, 18) + '...' : tabTitle}`;
            }
        } else {
            // Single tab - can use more space
            displayText = tabTitle.length > 30 ? tabTitle.substring(0, 28) + '...' : tabTitle;
        }
        
        tabTextWrapper.setText(displayText);
        
        // Add close button (x) that shows on hover
        const closeButton = tab.createDiv({
            cls: 'transcript-tab-close',
            attr: {
                'title': 'Remove this transcript',
                'aria-label': 'Remove transcript'
            }
        });
        closeButton.setText('×');
        
        // Handle close button click
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering tab selection
            // Use TranscriptManager to remove transcript
            this.plugin.transcriptManager.removeTranscriptTab(index);
        });
        
        if (isActive) {
            tab.classList.add('active');
        }
        
        return tab;
    }

    // Add the updateTranscriptTabsUI method
    private updateTranscriptTabsUI() {
        console.log('Updating transcript tabs UI, active index:', this.activeTranscriptIndex);
        
        if (!this.transcriptTabsContainer) {
            console.log('No transcript tabs container found');
            return;
        }
        
        // Get all tab items directly from the container
        const tabItems = this.transcriptTabsContainer.querySelectorAll('.transcript-tab-item');
        console.log('Found', tabItems.length, 'transcript tabs');
        
        tabItems.forEach((tab, index) => {
            const tabEl = tab as HTMLElement;
            const dataIndex = tabEl.getAttribute('data-index');
            const tabIndex = dataIndex ? parseInt(dataIndex, 10) : index;
            
            console.log(`Tab ${index} has data-index ${dataIndex}, comparing with active index ${this.activeTranscriptIndex}`);
            
            if (tabIndex === this.activeTranscriptIndex) {
                tabEl.classList.add('active');
                console.log(`Activated tab ${index} (data-index: ${dataIndex})`);
            } else {
                tabEl.classList.remove('active');
            }
        });
    }

    // Add the renderTranscriptContent method
    private renderTranscriptContent() {
        console.log('Rendering transcript content with', this.transcripts.length, 'transcripts and active index', this.activeTranscriptIndex);
        
        // First find the transcript content element
        const transcriptContentEl = this.transcriptContainer.querySelector('.transcript-content');
        // Early return if element not found
        if (!transcriptContentEl || !(transcriptContentEl instanceof HTMLElement)) {
            console.error('Transcript content element not found');
            return;
        }
        
        // Now using transcriptContentEl as HTMLElement
        transcriptContentEl.empty();
        
        // If no transcripts, show welcome screen instead of simple message
        if (this.transcripts.length === 0) {
            console.log('No transcripts available, showing welcome screen');
            // Remove any existing welcome screen
            const existingWelcomeScreen = this.transcriptContainer.querySelector('.empty-state-center-container');
            if (existingWelcomeScreen) {
                existingWelcomeScreen.remove();
            }
            
            // Create welcome screen directly under transcript-container instead of in transcript-content
            this.createWelcomeScreen(this.transcriptContainer);
            return;
        }
        
        // If there are transcripts, make sure we remove any welcome screen that might exist
        const welcomeScreen = this.transcriptContainer.querySelector('.empty-state-center-container');
        if (welcomeScreen) {
            welcomeScreen.remove();
        }
        
        // Get the active transcript
        const activeTranscript = this.transcripts[this.activeTranscriptIndex];
        if (!activeTranscript) {
            console.error('Active transcript not found at index', this.activeTranscriptIndex);
            return;
        }
        
        console.log('Rendering active transcript:', {
            title: activeTranscript.title,
            contentLength: activeTranscript.content.length,
            contentPreview: activeTranscript.content.substring(0, 50) + '...'
        });
        
        // Create a title element for the transcript
        const titleEl = transcriptContentEl.createEl('h2', {
            cls: 'transcript-title',
            text: activeTranscript.title
        });
        
        // Create paragraphs from the content
        const paragraphs = activeTranscript.content.split('. ').filter(p => p.trim());
        console.log('Split content into', paragraphs.length, 'paragraphs');
        
        // Render paragraphs
        paragraphs.forEach(paragraph => {
            const p = transcriptContentEl.createEl('p', {
                cls: 'transcript-paragraph'
            });
            p.textContent = paragraph.trim() + '.';
        });
        
        console.log('Finished rendering transcript content');
    }

    /**
     * Removes a transcript tab and its associated data
     * @param index The index of the transcript to remove
     */
    public removeTranscriptTab(index: number): void {
        // Confirm before removing
        const confirmRemove = confirm(`Are you sure you want to remove this transcript?`);
        if (!confirmRemove) return;
        
        console.log(`Removing transcript at index ${index}`);
        
        // Remove the transcript from the array
        if (index >= 0 && index < this.transcripts.length) {
            // Remove from transcript array
            this.transcripts.splice(index, 1);
            
            // Remove associated data
            const revisedContent = { ...this.revisedContents };
            delete revisedContent[index];
            
            const summaryContent = { ...this.summaryContents };
            delete summaryContent[index];
            
            const chatStates = { ...this.chatStates };
            delete chatStates[index];
            
            // Rebuild the contents objects with corrected indices
            this.revisedContents = {};
            this.summaryContents = {};
            this.chatStates = {};
            
            // Shift all data to fill in the gap
            Object.keys(revisedContent).forEach(key => {
                const keyNum = parseInt(key);
                if (keyNum > index) {
                    this.revisedContents[keyNum - 1] = revisedContent[keyNum];
                } else if (keyNum < index) {
                    this.revisedContents[keyNum] = revisedContent[keyNum];
                }
            });
            
            Object.keys(summaryContent).forEach(key => {
                const keyNum = parseInt(key);
                if (keyNum > index) {
                    this.summaryContents[keyNum - 1] = summaryContent[keyNum];
                } else if (keyNum < index) {
                    this.summaryContents[keyNum] = summaryContent[keyNum];
                }
            });
            
            Object.keys(chatStates).forEach(key => {
                const keyNum = parseInt(key);
                if (keyNum > index) {
                    this.chatStates[keyNum - 1] = chatStates[keyNum];
                } else if (keyNum < index) {
                    this.chatStates[keyNum] = chatStates[keyNum];
                }
            });
            
            // Update the combined content for backward compatibility using TranscriptManager
            this.plugin.transcriptManager.updateCombinedContent(this);
            
            // Update active transcript index
            if (this.transcripts.length === 0) {
                // No transcripts left, reset the view
                this.resetView();
                return;
            } else if (this.activeTranscriptIndex >= this.transcripts.length) {
                // If the active transcript was the last one, select the new last one
                this.activeTranscriptIndex = this.transcripts.length - 1;
            }
            
            // Save the modified state
            this.saveState();
            
            // Refresh the view to reflect changes
            this.refresh();
            
            new Notice('Transcript removed');
        } else {
            console.error(`Invalid transcript index: ${index}`);
        }
    }

    // Method to switch to global chat that works across all transcripts
    private switchToGlobalChat() {
        console.log('Switching to global chat across all transcripts');
        
        // Initialize global chat state if it doesn't exist
        if (!this.globalChatState) {
            this.globalChatState = { messages: [] };
        }
        
        // Update active tab to chat-all
        this.activeTab = 'chat-all';
        
        // Hide all other containers
        if (this.transcriptContainer) this.transcriptContainer.style.display = 'none';
        if (this.revisedContainer) this.revisedContainer.style.display = 'none';
        if (this.summaryContainer) this.summaryContainer.style.display = 'none';
        if (this.chatContainer) this.chatContainer.style.display = 'none';
        
        // Check if we already have a global chat container, create if not
        if (!this.globalChatContainer) {
            // Get the main container
            const container = this.containerEl.children[1] as HTMLElement;
            
            // Create global chat container
            this.globalChatContainer = container.createDiv({
                cls: 'global-chat-container chat-container'
            });
        }
        
        // Show the global chat container
        this.globalChatContainer.style.display = 'block';
        
        // Render the global chat interface
        this.renderGlobalChatInterface();
        
        // Update tab styles
        this.updateTabsUI();
        
        // Save state
        this.saveState();
    }

    // Render the global chat interface that works across all transcripts
    private renderGlobalChatInterface() {
        if (!this.globalChatContainer) return;
        
        this.globalChatContainer.empty();
        
        // Create chat toolbar container
        const chatToolbarContainer = this.globalChatContainer.createDiv({
            cls: 'chat-toolbar-container'
        });
        
        // Get fresh command context for the toolbar
        const toolbarContext = this.getCommandContext();
        
        // Add extra context specific to global chat
        toolbarContext.isGlobalChat = true;
        toolbarContext.chatMessages = this.globalChatState?.messages || [];
        
        // Create chat toolbar with standard context
        this.plugin.toolbarService.createToolbar(chatToolbarContainer, 'chat', toolbarContext);
        
        // Add model indicator to the toolbar
        const modelIndicator = chatToolbarContainer.createDiv({
            cls: 'model-indicator'
        });
        modelIndicator.innerText = `Model: ${this.plugin.settings.model}`;
        
        // Add "Chat All" indicator next to the model
        const globalChatIndicator = chatToolbarContainer.createDiv({
            cls: 'global-chat-indicator'
        });
        globalChatIndicator.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"></path></svg> Chat All';
        
        // Create a single scrollable container for messages
        const chatContentEl = this.globalChatContainer.createDiv({
            cls: 'chat-content'
        });
        
        // Add chat messages
        this.renderGlobalChatMessages(chatContentEl);
        
        // Add "Chatting across all transcripts" heading at the top of the chat
        if (!this.globalChatState?.messages || this.globalChatState.messages.length === 0) {
            const header = chatContentEl.createDiv({
                cls: 'global-chat-header'
            });
            
            header.createEl('h3', {
                text: 'Chatting across all transcripts'
            });
            
            // Create a list of all transcript titles
            if (this.transcripts && this.transcripts.length > 0) {
                const transcriptsList = header.createEl('ul', {
                    cls: 'global-chat-transcripts-list'
                });
                
                this.transcripts.forEach((transcript, index) => {
                    const title = transcript.title || `Video ${index + 1}`;
                    transcriptsList.createEl('li', {
                        text: title
                    });
                });
            }
        }
        
        // Similar event handlers for scrolling as in the regular chat interface
        // Reuse the same scroll to bottom button
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
        
        // Add scroll event listener for chat content
        let scrollTimeout: NodeJS.Timeout | null = null;
        const scrollHandler = (e: Event) => {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.checkScrollPosition(chatContentEl);
                scrollTimeout = null;
            }, 50);
        };
        chatContentEl.addEventListener('scroll', scrollHandler);
        
        // Initial check
        setTimeout(() => this.checkScrollPosition(chatContentEl), 100);
    }
    
    // Render messages for the global chat
    private renderGlobalChatMessages(container: HTMLElement) {
        // Clear the container first
        container.empty();
        
        // Check if global chat has any messages
        if (!this.globalChatState?.messages || this.globalChatState.messages.length === 0) {
            // Show welcome message for global chat
            container.createDiv({
                cls: 'empty-chat-message',
                text: 'Ask questions about all the transcripts at once'
            });
            return;
        }
        
        // Loop through and render each message
        this.globalChatState.messages.forEach(async (message, index) => {
            const messageDiv = container.createDiv({
                cls: `chat-message ${message.role}-message`
            });
            
            if (message.role === 'user') {
                // Simple text for user messages
                messageDiv.setText(message.content);
            } else {
                // Use standard MarkdownRenderer instead of executeExtensionTypeWord
                try {
                    await MarkdownRenderer.renderMarkdown(
                        message.content,
                        messageDiv,
                        this.app.workspace.getActiveFile()?.path || '',
                        this
                    );
                    
                    // Ensure links open in a new tab
                    messageDiv.querySelectorAll('a').forEach(a => {
                        a.setAttribute('target', '_blank');
                        a.setAttribute('rel', 'noopener noreferrer');
                    });
                } catch (error) {
                    console.error('Error rendering markdown in global chat message:', error);
                    messageDiv.setText(message.content); // Fallback to plain text
                }
            }
            
            // Add a clearfix after each message to prevent float issues
            container.createDiv({ cls: 'message-clearfix' });
        });
        
        // Scroll to bottom after rendering messages
        setTimeout(() => {
            this.scrollChatToBottom();
        }, 50);
    }

    // Add processGlobalAIResponse method
    private async processGlobalAIResponse(chatContentEl: HTMLElement) {
        try {
            // Show loading message
            const loadingContainer = chatContentEl.createDiv({
                cls: 'loading-spinner-container assistant-message'
            });
            
            loadingContainer.createDiv({
                cls: 'loading-spinner'
            });
            
            const loadingMessage = loadingContainer.createDiv({
                cls: 'loading-message',
                text: 'Thinking...'
            });
            
            // Create prompt with all transcripts combined
            let fullContext = "You are analyzing multiple video transcripts. Here are all the transcripts:\n\n";
            
            // Add each transcript with clear separation
            this.transcripts.forEach((transcript, index) => {
                const title = transcript.title || `Video ${index + 1}`;
                fullContext += `TRANSCRIPT ${index + 1}: ${title}\n`;
                fullContext += "---------------------\n";
                fullContext += transcript.content;
                fullContext += "\n\n";
            });
            
            // Get the last user message from global chat
            const lastUserMessage = this.globalChatState?.messages.slice(-1)[0];
            if (!lastUserMessage) {
                throw new Error('No user message found');
            }
            
            // Create message array for API call
            const messages = [
                { role: 'system', content: fullContext },
                ...this.globalChatState!.messages
            ];
            
            // Call OpenAI API using chatWithTranscript with an empty transcript
            // since we've already embedded the transcripts in the system message
            const response = await this.plugin.openaiService.chatWithTranscript(
                this.globalChatState!.messages,
                fullContext,
                "Multiple Transcripts"
            );
            
            // Remove the loading container
            if (loadingContainer && loadingContainer.parentElement) {
                loadingContainer.remove();
            }
            
            // Add response to chat
            this.globalChatState!.messages.push({
                role: 'assistant',
                content: response
            });
            
            // Re-render chat messages
            this.renderGlobalChatMessages(chatContentEl);
            
            // Save state
            this.saveState();
            
        } catch (error) {
            // Remove the loading container if it exists
            const loadingContainer = chatContentEl.querySelector('.loading-spinner-container');
            if (loadingContainer) {
                loadingContainer.remove();
            }
            
            // Show error message
            const errorContent = error instanceof Error ? error.message : 'Unknown error';
            const errorMessage = `Error: ${errorContent}`;
            
            // Add error message to chat
            if (this.globalChatState?.messages) {
                this.globalChatState.messages.push({
                    role: 'assistant',
                    content: errorMessage
                });
                
                // Re-render chat messages
                this.renderGlobalChatMessages(chatContentEl);
            }
            
            // Log error
            console.error('Error processing global chat:', error);
        }
    }
} 