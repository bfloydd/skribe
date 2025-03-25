import { Notice } from 'obsidian';
import { ToolbarConfig, ToolbarCommand, CommandContext } from '../types';
import { createCommonCommandReference } from './CommonCommands';
import type SkribePlugin from '../../main';

/**
 * Top toolbar commands
 */
const topToolbarCommands: ToolbarCommand[] = [
    {
        id: 'start-over',
        icon: 'rotate-ccw',
        tooltip: 'Start over',
        isEnabled: (context: CommandContext) => {
            return true; // Always enabled
        },
        execute: async (context: CommandContext) => {
            if (!context.view) {
                console.error('Cannot reset view: view object not found in context');
                new Notice('Error: Could not reset view');
                return;
            }

            try {
                // Ensure we're working with the TranscriptionView instance
                const view = context.view;
                if (typeof view.resetView === 'function') {
                    await view.resetView();
                    console.log('View reset successfully');
                } else {
                    throw new Error('resetView method not found on view');
                }
            } catch (error) {
                console.error('Error resetting view:', error);
                new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
];

/**
 * Transcript-specific commands
 */
const transcriptCommands: ToolbarCommand[] = [
    // Reference common commands
    createCommonCommandReference('copy'),
    createCommonCommandReference('save'),
    
    // Transcript-specific commands
    {
        id: 'play-tts',
        icon: 'play-circle',
        tooltip: 'Play/Pause transcript with TTS',
        isEnabled: (context: CommandContext) => {
            const hasContent = !!context.content;
            const hasApiKey = !!context.plugin?.settings?.openaiApiKey;
            
            if (!hasContent) {
                return false; // Disabled if no content
            }
            
            if (!hasApiKey) {
                return false; // Disabled if no API key
            }
            
            return true;
        },
        execute: async (context: CommandContext) => {
            if (!context.content) return;
            
            try {
                const plugin = context.plugin as SkribePlugin;
                
                if (!plugin.settings.openaiApiKey) {
                    new Notice('Please set your OpenAI API key in settings');
                    return;
                }

                // Toggle play/pause functionality would be implemented here
                // This would interact with the AudioPlayer service
                new Notice('TTS playback toggled');
            } catch (error) {
                console.error('TTS error:', error);
                new Notice(`TTS error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    // Enhance with AI (create summary) button
    {
        id: 'enhance-ai',
        icon: 'wand',
        tooltip: 'Enhance with AI (create summary)',
        isEnabled: (context: CommandContext) => {
            const hasContent = !!context.content;
            const hasApiKey = !!context.plugin?.settings?.openaiApiKey;
            
            // Simply return if both conditions are met
            return hasContent && hasApiKey;
        },
        execute: async (context: CommandContext) => {
            console.log('%c [TOOLBAR CONFIG] Executing enhance-ai command', 'background: #00ff00; color: black; padding: 4px;');
            
            if (!context.content) {
                new Notice('No content to enhance');
                return;
            }
            
            if (!context.plugin?.settings?.openaiApiKey) {
                new Notice('Please set your OpenAI API key in settings');
                try {
                    // Try to open settings
                    (context.plugin.app as any).setting?.open();
                    (context.plugin.app as any).setting?.openTabById('skribe');
                } catch (error) {
                    console.error('Could not open settings:', error);
                }
                return;
            }
            
            if (!context.view) {
                new Notice('View not found');
                return;
            }
            
            try {
                console.log('%c Calling view.enhanceWithAI directly', 'background: #007700; color: white; padding: 2px;');
                
                // Direct call
                if (typeof context.view.enhanceWithAI === 'function') {
                    context.view.enhanceWithAI();
                } else {
                    throw new Error('enhanceWithAI method not found on view');
                }
            } catch (error) {
                console.error('AI enhancement error:', error);
                new Notice(`AI enhancement error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    // Create revised version button
    {
        id: 'create-revised',
        icon: 'edit',
        tooltip: 'Create Revised Version',
        isEnabled: (context: CommandContext) => {
            const hasContent = !!context.content;
            const hasApiKey = !!context.plugin?.settings?.openaiApiKey;
            
            // Simply return if both conditions are met
            return hasContent && hasApiKey;
        },
        execute: async (context: CommandContext) => {
            console.log('%c [TOOLBAR CONFIG] Executing create-revised command', 'background: #0000ff; color: white; padding: 4px;');
            
            if (!context.content) {
                new Notice('No content to revise');
                return;
            }
            
            if (!context.plugin?.settings?.openaiApiKey) {
                new Notice('Please set your OpenAI API key in settings');
                try {
                    // Try to open settings
                    (context.plugin.app as any).setting?.open();
                    (context.plugin.app as any).setting?.openTabById('skribe');
                } catch (error) {
                    console.error('Could not open settings:', error);
                }
                return;
            }
            
            if (!context.view) {
                new Notice('View not found');
                return;
            }
            
            try {
                console.log('%c Calling view.createRevisedContent directly', 'background: #000077; color: white; padding: 2px;');
                
                // Direct call
                if (typeof context.view.createRevisedContent === 'function') {
                    context.view.createRevisedContent();
                } else {
                    throw new Error('createRevisedContent method not found on view');
                }
            } catch (error) {
                console.error('Create revised error:', error);
                new Notice(`Create revised error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
];

/**
 * Chat-specific commands
 */
const chatCommands: ToolbarCommand[] = [
    // Chat-specific commands
    {
        id: 'save-chat',
        icon: 'save',
        tooltip: 'Save chat history',
        isEnabled: (context: CommandContext) => {
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0;
        },
        execute: async (context: CommandContext) => {
            if (!context.chatMessages || !context.chatMessages.length) return;
            
            try {
                const plugin = context.plugin as SkribePlugin;
                
                // Extract video title and URL from the context
                const videoTitle = context.videoTitle || 'Untitled Video';
                const videoUrl = context.videoUrl || '';
                
                // Format the date to yyyy-mm-dd hh:mm format
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
                
                // Get first 20 chars of title (or less if title is shorter)
                const titlePrefix = videoTitle.replace(/[\\/:*?"<>|]/g, '-').substring(0, 20);
                
                // Try to extract v parameter from YouTube URL
                let vParam = '';
                if (videoUrl) {
                    // Use the YouTubeService to extract the video ID
                    vParam = plugin.youtubeService.extractVideoIdForFilename(videoUrl);
                }
                
                // Create filename
                const filename = `${plugin.settings.transcriptFolder}/${dateStr} ${timeStr} ${titlePrefix}${vParam ? ' ' + vParam : ''} chat.md`;
                
                // Format chat messages as markdown
                const chatContent = context.chatMessages.map((msg: { role: string; content: string }) => {
                    const role = msg.role === 'user' ? '**You**' : '**Assistant**';
                    return `${role}: ${msg.content}`;
                }).join('\n\n');
                
                // Add metadata
                const fileContent = [
                    '---',
                    'type: chat-export',
                    `created: ${now.toISOString()}`,
                    videoTitle ? `title: "${videoTitle}"` : '',
                    videoUrl ? `source: "${videoUrl}"` : '',
                    '---',
                    '',
                    videoTitle ? `# ${videoTitle} - Chat Export` : '# Chat Export',
                    '',
                    videoUrl ? `Source: [${videoUrl}](${videoUrl})` : '',
                    '',
                    chatContent
                ].filter(line => line !== '').join('\n');
                
                await plugin.app.vault.create(filename, fileContent);
                new Notice(`Chat exported to ${filename}`);
            } catch (error) {
                console.error('Export error:', error);
                new Notice(`Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    {
        id: 'append-chat',
        icon: 'file-plus',
        tooltip: 'Append chat to existing note',
        isEnabled: (context: CommandContext) => {
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0;
        },
        execute: async (context: CommandContext) => {
            if (!context.chatMessages || !context.chatMessages.length) return;
            
            try {
                const plugin = context.plugin as SkribePlugin;
                
                // Get active file if any
                const activeFile = plugin.app.workspace.getActiveFile();
                
                if (!activeFile) {
                    new Notice('No active file to append to. Please open a note first.');
                    return;
                }
                
                // Format chat messages as markdown
                const chatContent = context.chatMessages.map((msg: { role: string; content: string }) => {
                    const role = msg.role === 'user' ? '**You**' : '**Assistant**';
                    return `${role}: ${msg.content}`;
                }).join('\n\n');
                
                // Add section header with timestamp
                const timestamp = new Date().toLocaleString();
                const appendContent = [
                    '',
                    '## Chat Export - ' + timestamp,
                    '',
                    chatContent,
                    ''
                ].join('\n');
                
                // Read existing file content
                const existingContent = await plugin.app.vault.read(activeFile);
                
                // Append new content
                await plugin.app.vault.modify(activeFile, existingContent + appendContent);
                
                new Notice(`Chat appended to ${activeFile.name}`);
            } catch (error) {
                console.error('Append error:', error);
                new Notice(`Append error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    {
        id: 'clear-chat',
        icon: 'trash',
        tooltip: 'Clear chat history',
        isEnabled: (context: CommandContext) => {
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0;
        },
        execute: (context: CommandContext) => {
            if (context.onClearChat && typeof context.onClearChat === 'function') {
                context.onClearChat();
                new Notice('Chat history cleared');
            }
        }
    }
];

/**
 * Summary-specific commands
 */
const summaryCommands: ToolbarCommand[] = [
    // Reference common commands
    createCommonCommandReference('copy'),
    createCommonCommandReference('save'),
    
    // Summary-specific commands
    {
        id: 'regenerate-summary',
        icon: 'refresh-cw',
        tooltip: 'Regenerate summary',
        isEnabled: (context: CommandContext) => {
            return !!context.content && 
                   !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.content) return;
            
            try {
                const plugin = context.plugin as SkribePlugin;
                
                if (!plugin.settings.openaiApiKey) {
                    new Notice('Please set your OpenAI API key in settings');
                    return;
                }

                new Notice('Regenerating summary...');
                
                // This would call a method to regenerate the summary
                // For now, we'll just use the reformatText method
                const newSummary = await plugin.openaiService.reformatText(context.content);
                
                // Update the content
                if (typeof context.view.setContent === 'function') {
                    context.view.setContent(newSummary);
                }
                
                new Notice('Summary regenerated');
            } catch (error) {
                console.error('Summary regeneration error:', error);
                new Notice(`Summary error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
];

/**
 * Revised-specific commands
 */
const revisedCommands: ToolbarCommand[] = [
    // Reference common commands
    createCommonCommandReference('copy'),
    createCommonCommandReference('save'),
    
    // Revised-specific commands
    {
        id: 'regenerate-revised',
        icon: 'edit-2',
        tooltip: 'Regenerate revised content',
        isEnabled: (context: CommandContext) => {
            return !!context.content && 
                   !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.content) return;
            
            try {
                const plugin = context.plugin as SkribePlugin;
                
                if (!plugin.settings.openaiApiKey) {
                    new Notice('Please set your OpenAI API key in settings');
                    return;
                }

                new Notice('Regenerating revised content...');
                
                // Use the createRevisedTranscript method for better grammar and formatting
                const newContent = await plugin.openaiService.createRevisedTranscript(context.content);
                
                // Update the content
                if (typeof context.view.setRevisedContent === 'function') {
                    context.view.setRevisedContent(newContent);
                }
                
                new Notice('Revised content regenerated');
            } catch (error) {
                console.error('Revised content regeneration error:', error);
                new Notice(`Revised content error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
];

/**
 * Toolbar configurations for different tab types
 */
export const ToolbarConfigs: ToolbarConfig[] = [
    {
        id: 'top',
        name: 'Top Toolbar',
        commands: topToolbarCommands
    },
    {
        id: 'transcript',
        name: 'Transcript Toolbar',
        commands: transcriptCommands
    },
    {
        id: 'revised',
        name: 'Revised Toolbar',
        commands: revisedCommands
    },
    {
        id: 'chat',
        name: 'Chat Toolbar',
        commands: chatCommands
    },
    {
        id: 'summary',
        name: 'Summary Toolbar',
        commands: summaryCommands
    }
];

/**
 * Get a toolbar configuration by ID
 */
export function getToolbarConfig(id: string): ToolbarConfig | undefined {
    return ToolbarConfigs.find(config => config.id === id);
} 