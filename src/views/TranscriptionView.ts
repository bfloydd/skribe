import { ItemView, WorkspaceLeaf, setIcon, Notice, MarkdownRenderer } from 'obsidian';
import type SkribePlugin from '../../main';
import { OpenAIService } from '../services/OpenAIService';
import { AudioPlayer } from '../services/AudioPlayer';
import { ChatMessage, ChatState } from '../types';

export const VIEW_TYPE_TRANSCRIPTION = "transcription-view";

export class TranscriptionView extends ItemView {
    content: string;
    plugin: SkribePlugin;
    contentEl: HTMLElement;
    private audioPlayer: AudioPlayer | null = null;
    private videoUrl: string = '';
    private chatState: ChatState = { messages: [] };
    private activeTab: 'transcript' | 'chat' = 'chat';
    private transcriptContainer: HTMLElement;
    private chatContainer: HTMLElement;

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
            
            const promptMessage = promptContainer.createEl('div', {
                text: 'Skribe a video now',
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
                text: 'Get Transcript'
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

        // Render transcript content
        if (this.content) {
            await this.renderTranscriptContent();
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

        const buttonContainer = header.createDiv({
            cls: 'nav-buttons-container'
        });

        // Copy button
        const copyButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': 'Copy transcript',
                'disabled': !this.content
            }
        });
        setIcon(copyButton, 'copy');
        if (!this.content) {
            copyButton.addClass('disabled-button');
            copyButton.style.opacity = '0.5';
            copyButton.style.cursor = 'not-allowed';
        }
        copyButton.addEventListener('click', async () => {
            if (!this.content) return;
            await navigator.clipboard.writeText(this.content);
            new Notice('Transcript copied to clipboard');
        });

        // Save button
        const saveButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': 'Save transcript',
                'disabled': !this.content
            }
        });
        setIcon(saveButton, 'save');
        if (!this.content) {
            saveButton.addClass('disabled-button');
            saveButton.style.opacity = '0.5';
            saveButton.style.cursor = 'not-allowed';
        }
        saveButton.addEventListener('click', () => {
            if (!this.content) return;
            this.saveTranscript();
        });

        // Format button
        const formatButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': 'Enhance with AI (Format + Summary)',
                'title': 'Format transcript and add summary with key points',
                'disabled': !this.content
            }
        });
        setIcon(formatButton, 'wand');
        if (!this.content) {
            formatButton.addClass('disabled-button');
            formatButton.style.opacity = '0.5';
            formatButton.style.cursor = 'not-allowed';
        }
        formatButton.addEventListener('click', () => {
            if (!this.content) return;
            this.reformatWithAI();
        });

        // Play button (OpenAI TTS)
        const playButton = buttonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': 'Play/Pause transcript with TTS',
                'title': 'Play/Pause transcript using Text-to-Speech',
                'disabled': !this.content
            }
        });
        setIcon(playButton, 'play-circle');
        if (!this.content) {
            playButton.addClass('disabled-button');
            playButton.style.opacity = '0.5';
            playButton.style.cursor = 'not-allowed';
        }
        playButton.addEventListener('click', async () => {
            if (!this.content) return;
            try {
                if (!this.plugin.settings.openaiApiKey) {
                    new Notice('Please set your OpenAI API key in settings');
                    return;
                }

                if (!this.audioPlayer) {
                    this.audioPlayer = new AudioPlayer(
                        this.plugin.settings.openaiApiKey,
                        (isPlaying) => {
                            setIcon(playButton, isPlaying ? 'pause-circle' : 'play-circle');
                            const audioControls = this.containerEl.querySelector('.audio-controls') as HTMLElement;
                            if (audioControls) {
                                audioControls.style.display = isPlaying ? 'flex' : 'none';
                            }
                        },
                        OpenAIService.getInstance()
                    );
                    await this.audioPlayer.playText(this.content);
                } else {
                    this.audioPlayer.togglePlayPause();
                }
            } catch (error) {
                console.error('Error:', error);
                new Notice('Failed to play audio');
                setIcon(playButton, 'play-circle');
                const audioControls = this.containerEl.querySelector('.audio-controls') as HTMLElement;
                if (audioControls) {
                    audioControls.style.display = 'none';
                }
                this.audioPlayer = null;
            }
        });

        // Add audio controls
        const audioControls = container.createDiv({
            cls: 'nav-header audio-controls'
        });
        audioControls.style.display = 'none'; // Hide by default

        const audioButtonContainer = audioControls.createDiv({
            cls: 'nav-buttons-container'
        });

        // Stop button
        const stopButton = audioButtonContainer.createEl('button', {
            cls: 'clickable-icon',
            attr: { 
                'aria-label': 'Stop playback',
                'title': 'Stop playback'
            }
        });
        setIcon(stopButton, 'square');
        stopButton.addEventListener('click', () => {
            if (this.audioPlayer) {
                this.audioPlayer.stop();
                audioControls.style.display = 'none';
            }
        });

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

        // Transcript tab (now first)
        const transcriptTab = this.createTabItem(tabsContainer, 'Transcript', this.activeTab === 'transcript');
        
        // Chat tab (now second)
        const chatTab = this.createTabItem(tabsContainer, 'Chat', this.activeTab === 'chat');
        
        // Add click handlers
        chatTab.addEventListener('click', () => {
            this.activeTab = 'chat';
            this.transcriptContainer.style.display = 'none';
            this.chatContainer.style.display = 'block';
            this.updateTabStyles(chatTab, transcriptTab);
        });
        
        transcriptTab.addEventListener('click', () => {
            this.activeTab = 'transcript';
            this.transcriptContainer.style.display = 'block';
            this.chatContainer.style.display = 'none';
            this.updateTabStyles(transcriptTab, chatTab);
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
    
    private updateTabStyles(activeTab: HTMLElement, inactiveTab: HTMLElement) {
        activeTab.style.borderBottom = '2px solid var(--text-accent)';
        activeTab.style.fontWeight = 'bold';
        inactiveTab.style.borderBottom = '2px solid transparent';
        inactiveTab.style.fontWeight = 'normal';
    }

    private async renderTranscriptContent() {
        // Create markdown content container
        const markdownContainer = this.transcriptContainer.createDiv();
        
        await MarkdownRenderer.renderMarkdown(
            this.content,
            markdownContainer,
            this.app.workspace.getActiveFile()?.path || '',
            this
        );
    }

    private renderChatInterface() {
        // Create chat messages container
        const chatMessagesContainer = this.chatContainer.createDiv({
            cls: 'chat-messages-container'
        });
        chatMessagesContainer.style.overflowY = 'auto';
        chatMessagesContainer.style.marginBottom = '10px';
        chatMessagesContainer.style.padding = '10px';
        chatMessagesContainer.style.backgroundColor = 'var(--background-secondary)';
        chatMessagesContainer.style.borderRadius = '5px';

        // Render existing messages
        this.renderChatMessages(chatMessagesContainer);

        // Create chat input container
        const chatInputContainer = this.chatContainer.createDiv({
            cls: 'chat-input-container'
        });
        chatInputContainer.style.display = 'flex';
        chatInputContainer.style.gap = '10px';

        // Create chat input
        const chatInput = chatInputContainer.createEl('input', {
            cls: 'chat-input',
            attr: {
                type: 'text',
                placeholder: 'Start typing...'
            }
        });
        chatInput.style.flexGrow = '1';
        chatInput.style.padding = '8px';
        chatInput.style.borderRadius = '4px';
        chatInput.style.border = '1px solid var(--background-modifier-border)';

        // Create send button
        const sendButton = chatInputContainer.createEl('button', {
            cls: 'chat-send-button',
            text: 'Send'
        });
        sendButton.style.padding = '8px 16px';
        sendButton.style.borderRadius = '4px';
        sendButton.style.backgroundColor = 'var(--interactive-accent)';
        sendButton.style.color = 'var(--text-on-accent)';
        sendButton.style.cursor = 'pointer';
        sendButton.style.border = 'none';

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

            try {
                if (!this.plugin.settings.openaiApiKey) {
                    new Notice('Please set your OpenAI API key in settings');
                    return;
                }

                // Show loading indicator
                const loadingMessage = document.createElement('div');
                loadingMessage.className = 'chat-message assistant-message loading';
                loadingMessage.textContent = 'Thinking...';
                loadingMessage.style.padding = '10px';
                loadingMessage.style.marginBottom = '10px';
                loadingMessage.style.backgroundColor = 'var(--background-primary)';
                loadingMessage.style.borderRadius = '5px';
                loadingMessage.style.alignSelf = 'flex-start';
                loadingMessage.style.maxWidth = '80%';
                chatMessagesContainer.appendChild(loadingMessage);
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

                // Get response from OpenAI
                const openai = OpenAIService.getInstance();
                const response = await openai.chatWithTranscript(
                    this.chatState.messages,
                    this.content
                );

                // Remove loading indicator
                chatMessagesContainer.removeChild(loadingMessage);

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
} 