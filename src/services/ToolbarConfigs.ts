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
                // Ensure we're working with the SkribeView instance
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
    // Create revised version button
    {
        id: 'create-revised',
        icon: 'file-text',
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
    },
    // Enhance with AI (create summary) button
    {
        id: 'enhance-ai',
        icon: 'wand',
        tooltip: 'Generate Summary',
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
    // Adding append button
    {
        id: 'append',
        icon: 'arrow-down',
        tooltip: 'Append content to current note',
        isEnabled: (context: CommandContext) => {
            return !!context.content && !!context.plugin?.app.workspace.getActiveFile();
        },
        execute: async (context: CommandContext) => {
            if (!context.content) return;
            
            try {
                const plugin = context.plugin as SkribePlugin;
                
                // Get active file if any
                const activeFile = plugin.app.workspace.getActiveFile();
                
                if (!activeFile) {
                    new Notice('No active file to append to. Please open a note first.');
                    return;
                }
                
                // Format content as markdown
                const transcript = context.content;
                
                // Create content with a proper horizontal rule
                const timestamp = new Date().toLocaleString();
                const appendContent = [
                    '',
                    '',
                    '---',
                    '',
                    '## Transcript Append - ' + timestamp,
                    '',
                    transcript,
                    ''
                ].join('\n');
                
                // Read existing file content
                const existingContent = await plugin.app.vault.read(activeFile);
                
                // Append new content
                await plugin.app.vault.modify(activeFile, existingContent + appendContent);
                
                new Notice(`Content appended to ${activeFile.name}`);
            } catch (error) {
                console.error('Append error:', error);
                new Notice(`Append error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    // Adding clear button for transcript
    {
        id: 'clear-transcript',
        icon: 'trash',
        tooltip: 'Clear transcript',
        isEnabled: (context: CommandContext) => {
            return !!context.content;
        },
        execute: (context: CommandContext) => {
            try {
                if (context.view && typeof context.view.resetView === 'function') {
                    context.view.resetView();
                    new Notice('Transcript cleared');
                }
            } catch (error) {
                console.error('Clear transcript error:', error);
                new Notice(`Clear error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
];

/**
 * Chat-specific commands
 */
const chatCommands: ToolbarCommand[] = [
    // Custom copy command for chat tab (not using common reference)
    {
        id: 'copy',
        icon: 'copy',
        tooltip: 'Copy to clipboard',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have chat messages
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0;
        },
        execute: async (context: CommandContext) => {
            if (!context.chatMessages || !context.chatMessages.length) return;
            
            // Format chat messages as markdown for copying
            const chatContent = context.chatMessages.map((msg: { role: string; content: string }) => {
                const role = msg.role === 'user' ? '**You**' : '**Assistant**';
                return `${role}: ${msg.content}`;
            }).join('\n\n');
            
            // Copy to clipboard
            await navigator.clipboard.writeText(chatContent);
            new Notice('Chat content copied to clipboard');
        }
    },
    
    // Add other buttons from transcript with chat-specific isEnabled conditions
    {
        id: 'play-tts',
        icon: 'play-circle',
        tooltip: 'Play/Pause transcript with TTS',
        isEnabled: (context: CommandContext) => {
            // Use same conditions as save-chat
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0 &&
                   !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            // Same implementation as transcript
            if (!context.chatMessages || !context.chatMessages.length) return;
            
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
    // Create revised version button
    {
        id: 'create-revised',
        icon: 'file-text',
        tooltip: 'Create Revised Version',
        isEnabled: (context: CommandContext) => {
            // Use same conditions as save-chat
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0 &&
                   !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.chatMessages || !context.chatMessages.length) return;
            
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
            
            // Instead of calling enhanceWithAI, we'll call createRevisedContent
            try {
                if (typeof context.view.createRevisedContent === 'function') {
                    context.view.createRevisedContent();
                } else {
                    throw new Error('createRevisedContent method not found on view');
                }
            } catch (error) {
                console.error('AI revision error:', error);
                new Notice(`AI revision error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    // Add enhance-ai button
    {
        id: 'enhance-ai',
        icon: 'wand',
        tooltip: 'Generate Summary',
        isEnabled: (context: CommandContext) => {
            // Use same conditions as save-chat
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0 &&
                   !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.chatMessages || !context.chatMessages.length) return;
            
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
    // Add back the original chat commands
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
                
                // Clean the URL to keep only essential parameters
                const cleanVideoUrl = videoUrl ? plugin.youtubeService.cleanYouTubeUrl(videoUrl) : '';
                
                // Format the date to yyyy-mm-dd hh:mm format
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toLocaleTimeString('en-US', { 
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                }).replace(':', '-');
                
                // Get first 30 chars of title (or less if title is shorter)
                const titlePrefix = videoTitle.replace(/[\\/:*?"<>|]/g, '-').substring(0, 30);
                
                // Try to extract v parameter from YouTube URL
                let vParam = '';
                if (videoUrl) {
                    // Use the YouTubeService to extract the video ID
                    vParam = plugin.youtubeService.extractVideoIdForFilename(videoUrl);
                }
                
                // Create filename
                let filename = '';
                // Add content type suffix if setting is enabled
                let contentTypeSuffix = '';
                if (plugin.settings.includeContentTypeInFilename === true) {
                    contentTypeSuffix = ' chat';
                }

                if (plugin.settings.includeTimestampInFilename === true) {
                    // With timestamp
                    filename = `${plugin.settings.transcriptFolder}/${dateStr}-${timeStr} ${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                } else {
                    // Without timestamp
                    filename = `${plugin.settings.transcriptFolder}/${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                }
                
                // Check if file exists and add number suffix if needed
                const exists = await plugin.app.vault.adapter.exists(filename);
                if (exists) {
                    let counter = 1;
                    let newFilename = '';
                    do {
                        // Remove the .md extension
                        const baseFilename = filename.replace(/\.md$/, '');
                        newFilename = `${baseFilename} (${counter}).md`;
                        counter++;
                    } while (await plugin.app.vault.adapter.exists(newFilename));
                    
                    filename = newFilename;
                }
                
                // Format chat messages as markdown
                const chatContent = context.chatMessages.map((msg: { role: string; content: string }) => {
                    const role = msg.role === 'user' ? '**You**' : '**Assistant**';
                    return `${role}: ${msg.content}`;
                }).join('\n\n');
                
                // Add metadata at the top of the file
                const fileContent = [
                    '---',
                    'type: chat',
                    `created: ${new Date().toISOString()}`,
                    videoTitle ? `title: "${videoTitle}"` : '',
                    cleanVideoUrl ? `source: "${cleanVideoUrl}"` : '',
                    '---',
                    '',
                    videoTitle ? `# ${videoTitle} - Chat` : '# Video Chat',
                    '',
                    cleanVideoUrl ? `Source: [${cleanVideoUrl}](${cleanVideoUrl})` : '',
                    '',
                    chatContent
                ].filter(line => line !== '').join('\n');
                
                try {
                    const filePath = await plugin.createFileWithUniqueName(filename, fileContent, true);
                    new Notice('Chat saved and opened');
                } catch (error) {
                    new Notice(`Error saving chat: ${error.message}`);
                }
            } catch (error) {
                console.error('Export error:', error);
                new Notice(`Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    {
        id: 'append',
        icon: 'arrow-down',
        tooltip: 'Append content to current note',
        isEnabled: (context: CommandContext) => {
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0 &&
                   !!context.plugin?.app.workspace.getActiveFile();
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
                
                // Create content with a proper horizontal rule and changed header text
                const timestamp = new Date().toLocaleString();
                const appendContent = [
                    '',
                    '',
                    '---',
                    '',
                    '## Chat Append - ' + timestamp,
                    '',
                    chatContent,
                    ''
                ].join('\n');
                
                // Read existing file content
                const existingContent = await plugin.app.vault.read(activeFile);
                
                // Append new content
                await plugin.app.vault.modify(activeFile, existingContent + appendContent);
                
                new Notice(`Content appended to ${activeFile.name}`);
            } catch (error) {
                console.error('Append error:', error);
                new Notice(`Append error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    {
        id: 'clear-chat',
        icon: 'trash',
        tooltip: 'Clear chat contents',
        isEnabled: (context: CommandContext) => {
            return context.activeTab === 'chat' && 
                   Array.isArray(context.chatMessages) && 
                   context.chatMessages.length > 0;
        },
        execute: (context: CommandContext) => {
            try {
                if (context.view && typeof context.view.clearChat === 'function') {
                    // Use the clearChat method
                    context.view.clearChat();
                    new Notice('Chat contents cleared');
                } else {
                    // Fallback to old method if clearChat is not available
                    if (context.chatState && Array.isArray(context.chatState.messages)) {
                        context.chatState.messages = [];
                        
                        // Refresh the view if possible
                        if (context.view && typeof context.view.renderChatMessages === 'function') {
                            context.view.renderChatMessages();
                        }
                        
                        new Notice('Chat contents cleared');
                    } else if (Array.isArray(context.chatMessages)) {
                        // Empty the array directly if chatState is not available
                        context.chatMessages.length = 0;
                        
                        // Force a refresh if possible
                        if (context.view && typeof context.view.refresh === 'function') {
                            context.view.refresh();
                        }
                        
                        new Notice('Chat contents cleared');
                    }
                }
            } catch (error) {
                console.error('Clear chat error:', error);
                new Notice(`Clear error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
];

/**
 * Summary-specific commands
 */
const summaryCommands: ToolbarCommand[] = [
    // Custom copy command for summary tab
    {
        id: 'copy',
        icon: 'copy',
        tooltip: 'Copy to clipboard',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have summary content
            return !!context.summaryContent;
        },
        execute: async (context: CommandContext) => {
            if (!context.summaryContent) return;
            await navigator.clipboard.writeText(context.summaryContent);
            new Notice('Summary copied to clipboard');
        }
    },
    // Custom save command for summary tab
    {
        id: 'save',
        icon: 'save',
        tooltip: 'Save summary',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have summary content
            return !!context.summaryContent;
        },
        execute: async (context: CommandContext) => {
            if (!context.summaryContent || !context.view) return;
            
            // Use a generic approach
            const plugin = context.plugin as SkribePlugin;
            
            // Extract video title and URL from the context
            const videoTitle = context.videoTitle || 'Untitled Video';
            const videoUrl = context.videoUrl || '';
            
            // Clean the URL to keep only essential parameters
            const cleanVideoUrl = videoUrl ? plugin.youtubeService.cleanYouTubeUrl(videoUrl) : '';
            
            // Format the date to yyyy-mm-dd hh:mm format
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            }).replace(':', '-');
            
            // Get first 30 chars of title (or less if title is shorter)
            const titlePrefix = videoTitle.replace(/[\\/:*?"<>|]/g, '-').substring(0, 30);
            
            // Try to extract v parameter from YouTube URL
            let vParam = '';
            if (videoUrl) {
                // Use the YouTubeService to extract the video ID
                vParam = plugin.youtubeService.extractVideoIdForFilename(videoUrl);
            }
            
            // Create filename
            let filename = '';
            // Add content type suffix if setting is enabled
            let contentTypeSuffix = '';
            if (plugin.settings.includeContentTypeInFilename === true) {
                contentTypeSuffix = ' summary';
            }

            if (plugin.settings.includeTimestampInFilename === true) {
                // With timestamp
                filename = `${plugin.settings.transcriptFolder}/${dateStr}-${timeStr} ${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
            } else {
                // Without timestamp
                filename = `${plugin.settings.transcriptFolder}/${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
            }
            
            // Add metadata at the top of the file
            const fileContent = [
                '---',
                'type: summary',
                `created: ${new Date().toISOString()}`,
                videoTitle ? `title: "${videoTitle}"` : '',
                cleanVideoUrl ? `source: "${cleanVideoUrl}"` : '',
                '---',
                '',
                videoTitle ? `# ${videoTitle} - Summary` : '# Video Summary',
                '',
                cleanVideoUrl ? `Source: [${cleanVideoUrl}](${cleanVideoUrl})` : '',
                '',
                context.summaryContent
            ].filter(line => line !== '').join('\n');
            
            // Create the file
            try {
                const filePath = await plugin.createFileWithUniqueName(filename, fileContent, true);
                new Notice(`Summary saved and opened`);
            } catch (error) {
                new Notice(`Error saving file: ${error.message}`);
            }
        }
    },
    
    // Toolbar commands - copy from transcript but adjust isEnabled logic
    {
        id: 'play-tts',
        icon: 'play-circle',
        tooltip: 'Play/Pause transcript with TTS',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have summary content
            return !!context.summaryContent && !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.summaryContent) return;
            
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
    
    // Create revised version button
    {
        id: 'create-revised',
        icon: 'file-text',
        tooltip: 'Create Revised Version',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have summary content
            return !!context.summaryContent && !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.summaryContent) return;
            
            try {
                const view = context.view;
                
                if (!view) {
                    new Notice('View not found');
                    return;
                }
                
                if (typeof view.createRevisedContent === 'function') {
                    // Call the createRevisedContent method on the view
                    view.createRevisedContent();
                } else {
                    throw new Error('createRevisedContent method not found on view');
                }
            } catch (error) {
                console.error('Create revised error:', error);
                new Notice(`Create revised error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    
    // Enhance with AI (create summary) button - always enabled
    {
        id: 'enhance-ai',
        icon: 'wand',
        tooltip: 'Generate Summary',
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
                console.error('Enhance with AI error:', error);
                new Notice(`Enhancement error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    
    // Adding append button
    {
        id: 'append',
        icon: 'arrow-down',
        tooltip: 'Append content to current note',
        isEnabled: (context: CommandContext) => {
            return !!context.summaryContent && !!context.plugin?.app.workspace.getActiveFile();
        },
        execute: async (context: CommandContext) => {
            if (!context.summaryContent) return;
            
            try {
                const plugin = context.plugin as SkribePlugin;
                
                // Get active file if any
                const activeFile = plugin.app.workspace.getActiveFile();
                
                if (!activeFile) {
                    new Notice('No active file to append to. Please open a note first.');
                    return;
                }
                
                // Format content as markdown
                const content = context.summaryContent;
                
                // Create content with a proper horizontal rule
                const timestamp = new Date().toLocaleString();
                const appendContent = [
                    '',
                    '',
                    '---',
                    '',
                    '## Summary Append - ' + timestamp,
                    '',
                    content,
                    ''
                ].join('\n');
                
                // Read existing file content
                const existingContent = await plugin.app.vault.read(activeFile);
                
                // Append new content
                await plugin.app.vault.modify(activeFile, existingContent + appendContent);
                
                new Notice(`Content appended to ${activeFile.name}`);
            } catch (error) {
                console.error('Append error:', error);
                new Notice(`Append error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    
    // Adding clear button for summary
    {
        id: 'clear-summary',
        icon: 'trash',
        tooltip: 'Clear summary content',
        isEnabled: (context: CommandContext) => {
            return !!context.summaryContent;
        },
        execute: (context: CommandContext) => {
            try {
                if (context.view && typeof context.view.clearSummary === 'function') {
                    context.view.clearSummary();
                    new Notice('Summary content cleared');
                } else {
                    // Fallback if method not available
                    if (context.view) {
                        context.view.summaryContent = '';
                        if (typeof context.view.refresh === 'function') {
                            context.view.refresh();
                        }
                        new Notice('Summary content cleared');
                    }
                }
            } catch (error) {
                console.error('Clear summary error:', error);
                new Notice(`Clear error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
];

/**
 * Revised-specific commands
 */
const revisedCommands: ToolbarCommand[] = [
    // Custom copy command for revised tab
    {
        id: 'copy',
        icon: 'copy',
        tooltip: 'Copy to clipboard',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have revised content
            return !!context.revisedContent;
        },
        execute: async (context: CommandContext) => {
            if (!context.revisedContent) return;
            await navigator.clipboard.writeText(context.revisedContent);
            new Notice('Revised content copied to clipboard');
        }
    },
    // Custom save command for revised tab
    {
        id: 'save',
        icon: 'save',
        tooltip: 'Save revised version',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have revised content
            return !!context.revisedContent;
        },
        execute: async (context: CommandContext) => {
            if (!context.revisedContent || !context.view) return;
            
            // Use the view's public methods or fallback to generic implementation
            if (context.view) {
                // Use a generic approach
                const plugin = context.plugin as SkribePlugin;
                
                // Extract video title and URL from the context
                const videoTitle = context.videoTitle || 'Untitled Video';
                const videoUrl = context.videoUrl || '';
                
                // Clean the URL to keep only essential parameters
                const cleanVideoUrl = videoUrl ? plugin.youtubeService.cleanYouTubeUrl(videoUrl) : '';
                
                // Format the date to yyyy-mm-dd hh:mm format
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toLocaleTimeString('en-US', { 
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                }).replace(':', '-');
                
                // Get first 30 chars of title (or less if title is shorter)
                const titlePrefix = videoTitle.replace(/[\\/:*?"<>|]/g, '-').substring(0, 30);
                
                // Try to extract v parameter from YouTube URL
                let vParam = '';
                if (videoUrl) {
                    // Use the YouTubeService to extract the video ID
                    vParam = plugin.youtubeService.extractVideoIdForFilename(videoUrl);
                }
                
                // Create filename
                let filename = '';
                // Add content type suffix if setting is enabled
                let contentTypeSuffix = '';
                if (plugin.settings.includeContentTypeInFilename === true) {
                    contentTypeSuffix = ' revised';
                }

                if (plugin.settings.includeTimestampInFilename === true) {
                    // With timestamp
                    filename = `${plugin.settings.transcriptFolder}/${dateStr}-${timeStr} ${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                } else {
                    // Without timestamp 
                    filename = `${plugin.settings.transcriptFolder}/${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                }
                
                // Add metadata at the top of the file
                const fileContent = [
                    '---',
                    'type: revised_transcript',
                    `created: ${new Date().toISOString()}`,
                    videoTitle ? `title: "${videoTitle}"` : '',
                    cleanVideoUrl ? `source: "${cleanVideoUrl}"` : '',
                    '---',
                    '',
                    videoTitle ? `# ${videoTitle} - Revised` : '# Revised Transcript',
                    '',
                    cleanVideoUrl ? `Source: [${cleanVideoUrl}](${cleanVideoUrl})` : '',
                    '',
                    context.revisedContent
                ].filter(line => line !== '').join('\n');
                
                // Create the file
                try {
                    const filePath = await plugin.createFileWithUniqueName(filename, fileContent, true);
                    new Notice(`Revised transcript saved and opened`);
                } catch (error) {
                    new Notice(`Error saving file: ${error.message}`);
                }
            }
        }
    },
    
    // Toolbar commands - copy from transcript but adjust isEnabled logic
    {
        id: 'play-tts',
        icon: 'play-circle',
        tooltip: 'Play/Pause transcript with TTS',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have revised content
            return !!context.revisedContent && !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.revisedContent) return;
            
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
    
    // Create revised version button - always enabled
    {
        id: 'create-revised',
        icon: 'file-text',
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
    },
    
    // Enhance with AI (create summary) button
    {
        id: 'enhance-ai',
        icon: 'wand',
        tooltip: 'Generate Summary',
        isEnabled: (context: CommandContext) => {
            // Only enable if we have revised content
            return !!context.revisedContent && !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.revisedContent) return;
            
            try {
                const view = context.view;
                
                if (!view) {
                    new Notice('View not found');
                    return;
                }
                
                if (typeof view.enhanceWithAI === 'function') {
                    // Call the enhanceWithAI method on the view
                    await view.enhanceWithAI();
                } else {
                    throw new Error('enhanceWithAI method not found on view');
                }
            } catch (error) {
                console.error('Enhance with AI error:', error);
                new Notice(`Enhancement error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    
    // Adding append button
    {
        id: 'append',
        icon: 'arrow-down',
        tooltip: 'Append content to current note',
        isEnabled: (context: CommandContext) => {
            return !!context.revisedContent && !!context.plugin?.app.workspace.getActiveFile();
        },
        execute: async (context: CommandContext) => {
            if (!context.revisedContent) return;
            
            try {
                const plugin = context.plugin as SkribePlugin;
                
                // Get active file if any
                const activeFile = plugin.app.workspace.getActiveFile();
                
                if (!activeFile) {
                    new Notice('No active file to append to. Please open a note first.');
                    return;
                }
                
                // Format content as markdown
                const content = context.revisedContent;
                
                // Create content with a proper horizontal rule
                const timestamp = new Date().toLocaleString();
                const appendContent = [
                    '',
                    '',
                    '---',
                    '',
                    '## Revised Transcript Append - ' + timestamp,
                    '',
                    content,
                    ''
                ].join('\n');
                
                // Read existing file content
                const existingContent = await plugin.app.vault.read(activeFile);
                
                // Append new content
                await plugin.app.vault.modify(activeFile, existingContent + appendContent);
                
                new Notice(`Content appended to ${activeFile.name}`);
            } catch (error) {
                console.error('Append error:', error);
                new Notice(`Append error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    },
    
    // Adding clear button for revised
    {
        id: 'clear-revised',
        icon: 'trash',
        tooltip: 'Clear revised content',
        isEnabled: (context: CommandContext) => {
            return !!context.revisedContent;
        },
        execute: (context: CommandContext) => {
            try {
                if (context.view && typeof context.view.clearRevised === 'function') {
                    context.view.clearRevised();
                    new Notice('Revised content cleared');
                } else {
                    // Fallback if method not available
                    if (context.view) {
                        context.view.revisedContent = '';
                        if (typeof context.view.refresh === 'function') {
                            context.view.refresh();
                        }
                        new Notice('Revised content cleared');
                    }
                }
            } catch (error) {
                console.error('Clear revised error:', error);
                new Notice(`Clear error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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