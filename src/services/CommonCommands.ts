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
                const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
                
                // Get first 20 chars of title (or less if title is shorter)
                const titlePrefix = videoTitle.replace(/[\\/:*?"<>|]/g, '-').substring(0, 20);
                
                // Try to extract v parameter from YouTube URL
                let vParam = '';
                if (videoUrl) {
                    // Use the YouTubeService to extract the video ID
                    vParam = plugin.youtubeService.extractVideoIdForFilename(videoUrl);
                }
                
                // Determine content type suffix based on active tab
                let contentTypeSuffix = '';
                const activeTab = context.activeTab || 'transcript';
                if (activeTab === 'revised') {
                    contentTypeSuffix = ' revised';
                } else if (activeTab === 'summary') {
                    contentTypeSuffix = ' summary';
                } else if (activeTab === 'transcript') {
                    contentTypeSuffix = ' transcript';
                }
                
                // Create filename
                const filename = `${plugin.settings.transcriptFolder}/${dateStr} ${timeStr} ${titlePrefix}${vParam ? ' ' + vParam : ''}${contentTypeSuffix}.md`;
                
                // Add metadata and content including title and link at the top
                const fileContent = [
                    '---',
                    `type: ${activeTab}`,
                    `created: ${now.toISOString()}`,
                    videoTitle ? `title: "${videoTitle}"` : '',
                    cleanVideoUrl ? `source: "${cleanVideoUrl}"` : '',
                    '---',
                    '',
                    videoTitle ? `# ${videoTitle}${contentTypeSuffix ? ' - ' + activeTab.charAt(0).toUpperCase() + activeTab.slice(1) : ''}` : `# Video ${contentTypeSuffix ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1) : 'Transcript'}`,
                    '',
                    cleanVideoUrl ? `Source: [${cleanVideoUrl}](${cleanVideoUrl})` : '',
                    '',
                    context.content
                ].filter(line => line !== '').join('\n');
                
                await plugin.app.vault.create(filename, fileContent);
                new Notice(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} saved`);
            } else {
                // Generic save implementation
                const plugin = context.plugin as SkribePlugin;
                const now = new Date();
                const dateStr = now.toISOString().split('T')[0];
                const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
                const contentType = context.activeTab || 'content';
                const filename = `${plugin.settings.transcriptFolder}/${dateStr} ${timeStr} generic ${contentType}.md`;
                
                await plugin.app.vault.create(filename, context.content);
                new Notice(`${contentType.charAt(0).toUpperCase() + contentType.slice(1)} saved to ${filename}`);
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
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `${plugin.settings.transcriptFolder}/summary-${timestamp}.md`;
                
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
                const file = await plugin.app.vault.create(filename, fileContent);
                
                // Open the file in a new tab
                await plugin.app.workspace.getLeaf(true).openFile(file);
                
                // Hide the loading notice and show success
                loadingNotice.hide();
                new Notice('Summary created and opened in new tab');
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