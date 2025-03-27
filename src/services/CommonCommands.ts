import { Notice } from 'obsidian';
import { ToolbarCommand, CommandContext } from '../types';
import type SkribePlugin from '../../main';
import { SkribeView } from '../views/SkribeView';

/**
 * Common commands that can be shared across different toolbars
 */
export const CommonCommands: ToolbarCommand[] = [
    // Copy command
    {
        id: 'copy',
        icon: 'copy',
        tooltip: 'Copy to clipboard',
        isEnabled: (context: CommandContext) => !!context.content,
        execute: async (context: CommandContext) => {
            if (!context.content) return;
            await navigator.clipboard.writeText(context.content);
            new Notice('Content copied to clipboard');
        }
    },
    
    // Save command
    {
        id: 'save',
        icon: 'save',
        tooltip: 'Save content',
        isEnabled: (context: CommandContext) => !!context.content,
        execute: async (context: CommandContext) => {
            if (!context.content || !context.view) return;
            
            // Use the view's public methods or fallback to generic implementation
            if (context.view instanceof SkribeView) {
                // Since saveTranscript is private, we'll use a generic approach
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
                
                // Determine content type suffix based on active tab
                let contentTypeSuffix = '';
                if (plugin.settings.includeContentTypeInFilename === true) {
                    const activeTab = context.activeTab || 'transcript';
                    if (activeTab === 'revised') {
                        contentTypeSuffix = ' revised';
                    } else if (activeTab === 'summary') {
                        contentTypeSuffix = ' summary';
                    } else if (activeTab === 'transcript') {
                        contentTypeSuffix = ' transcript';
                    }
                }
                
                // Create filename
                let filename = '';
                if (plugin.settings.includeTimestampInFilename === true) {
                    // With timestamp
                    filename = `${plugin.settings.transcriptFolder}/${dateStr}-${timeStr} ${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                } else {
                    // Without timestamp
                    filename = `${plugin.settings.transcriptFolder}/${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                    
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
                }
                
                // Add metadata and content including title and link at the top
                const fileContent = [
                    '---',
                    `type: ${context.activeTab || 'transcript'}`,
                    `created: ${now.toISOString()}`,
                    videoTitle ? `title: "${videoTitle}"` : '',
                    cleanVideoUrl ? `source: "${cleanVideoUrl}"` : '',
                    '---',
                    '',
                    videoTitle ? `# ${videoTitle}${contentTypeSuffix ? ' - ' + (context.activeTab || 'transcript').charAt(0).toUpperCase() + (context.activeTab || 'transcript').slice(1) : ''}` : `# Video ${contentTypeSuffix ? (context.activeTab || 'transcript').charAt(0).toUpperCase() + (context.activeTab || 'transcript').slice(1) : 'Transcript'}`,
                    '',
                    cleanVideoUrl ? `Source: [${cleanVideoUrl}](${cleanVideoUrl})` : '',
                    '',
                    context.content
                ].filter(line => line !== '').join('\n');
                
                // Create the file
                try {
                    await plugin.createFileWithUniqueName(filename, fileContent);
                    new Notice(`${(context.activeTab || 'transcript').charAt(0).toUpperCase() + (context.activeTab || 'transcript').slice(1)} saved`);
                } catch (error) {
                    new Notice(`Error saving file: ${error.message}`);
                }
            } else {
                // Generic save implementation
                const plugin = context.plugin as SkribePlugin;
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toLocaleTimeString('en-US', { 
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                }).replace(':', '-');
                const contentType = context.activeTab || 'content';
                
                // Add content type suffix if setting is enabled
                let contentTypeSuffix = '';
                if (plugin.settings.includeContentTypeInFilename === true) {
                    contentTypeSuffix = ` ${contentType}`;
                }
                
                // Create filename
                let filename = '';
                if (plugin.settings.includeTimestampInFilename === true) {
                    // With timestamp
                    filename = `${plugin.settings.transcriptFolder}/${dateStr}-${timeStr} generic${contentTypeSuffix}.md`;
                } else {
                    // Without timestamp
                    filename = `${plugin.settings.transcriptFolder}/generic${contentTypeSuffix}.md`;
                }
                
                try {
                    await plugin.createFileWithUniqueName(filename, context.content);
                    new Notice(`Content saved`);
                } catch (error) {
                    new Notice(`Error saving file: ${error.message}`);
                }
            }
        }
    },
    
    // Format with AI command
    {
        id: 'format-ai',
        icon: 'wand',
        tooltip: 'Enhance with AI (Format + Summary)',
        isEnabled: (context: CommandContext) => {
            console.log('format-ai isEnabled check', {
                hasContent: !!context.content,
                contentLength: context.content?.length,
                hasPlugin: !!context.plugin,
                hasApiKey: !!context.plugin?.settings?.openaiApiKey,
                view: context.view?.constructor.name
            });
            
            // Make sure we have content and an API key
            return !!context.content && 
                   !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            console.log('format-ai execute called', {
                hasContent: !!context.content,
                contentLength: context.content?.length,
                hasView: !!context.view,
                viewType: context.view?.constructor.name
            });
            
            // Check if we're in a SkribeView
            if (context.view && context.view.constructor.name === 'SkribeView') {
                console.log('format-ai: Calling enhanceWithAI directly on SkribeView');
                await context.view.enhanceWithAI();
                return;
            }
            console.log('format-ai: Not a SkribeView, using fallback approach');
            
            if (!context.content) {
                console.error('format-ai: No content available');
                new Notice('No content available for AI enhancement');
                return;
            }
            
            if (!context.plugin?.settings?.openaiApiKey) {
                console.error('format-ai: No OpenAI API key set');
                new Notice('Please set your OpenAI API key in settings');
                return;
            }
            
            // Show a persistent notification while processing
            console.log('format-ai: Showing Summarizing notice');
            const loadingNotice = new Notice('Summarizing...', 0);
            const plugin = context.plugin;
            
            try {
                // Use the OpenAI service's reformatText method
                const formattedContent = await plugin.openaiService.reformatText(context.content);
                console.log('Received formatted content, length:', formattedContent?.length);
                
                if (!formattedContent) {
                    throw new Error('Received empty response from OpenAI');
                }
                
                // Create AI Summary file
                const date = new Date();
                const dateStr = date.toISOString().split('T')[0];
                const timeStr = date.toLocaleTimeString('en-US', { 
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                }).replace(':', '-');
                const titlePrefix = context.title || 'summary';
                const vParam = context.vParam || '';

                // Add content type suffix if setting is enabled
                let contentTypeSuffix = '';
                if (plugin.settings.includeContentTypeInFilename === true) {
                    contentTypeSuffix = ' ai summary';
                }
                
                // Create filename
                let filename = '';
                if (plugin.settings.includeTimestampInFilename === true) {
                    // With timestamp
                    filename = `${plugin.settings.transcriptFolder}/${dateStr}-${timeStr} ${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                } else {
                    // Without timestamp
                    filename = `${plugin.settings.transcriptFolder}/${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                    
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
                }
                
                // Add metadata at the top of the file
                const fileContent = [
                    '---',
                    'type: summary',
                    `created: ${new Date().toISOString()}`,
                    `video_url: ${context.videoUrl || ''}`,
                    '---',
                    '',
                    formattedContent
                ].join('\n');
                
                // Create the file
                try {
                    const file = await plugin.createFileWithUniqueName(filename, fileContent);
                    
                    // Open the file in a new tab
                    await plugin.app.workspace.getLeaf(true).openFile(file);
                    
                    // Hide the loading notice and show success
                    loadingNotice.hide();
                    new Notice('Summary created!');
                } catch (error) {
                    loadingNotice.hide();
                    new Notice(`Error saving file: ${error.message}`);
                }
            } catch (error) {
                console.error('AI formatting error:', error);
                // Hide the loading notice and show error
                loadingNotice.hide();
                new Notice(`AI enhancement error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
];

/**
 * Factory function to create a command that references a common command
 */
export function createCommonCommandReference(commonCommandId: string): ToolbarCommand {
    const command = CommonCommands.find(cmd => cmd.id === commonCommandId);
    
    if (!command) {
        throw new Error(`Common command not found: ${commonCommandId}`);
    }
    
    return {
        id: `common:${commonCommandId}`,
        icon: command.icon,
        tooltip: command.tooltip,
        isEnabled: command.isEnabled,
        execute: async (context: CommandContext) => {
            console.log(`Executing common command reference: ${commonCommandId}`, {
                hasContent: !!context.content,
                contentLength: context.content?.length,
                hasView: !!context.view,
                viewType: context.view?.constructor.name
            });
            
            // Call the original execute function with the provided context
            return command.execute(context);
        }
    };
} 