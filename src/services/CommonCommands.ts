import { Notice } from 'obsidian';
import { ToolbarCommand, CommandContext } from '../types';
import type SkribePlugin from '../../main';
import { TranscriptionView } from '../views/TranscriptionView';

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
            if (context.view instanceof TranscriptionView) {
                // Since saveTranscript is private, we'll use a generic approach
                const plugin = context.plugin as SkribePlugin;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `${plugin.settings.transcriptFolder}/transcript-${timestamp}.md`;
                
                // Add metadata at the top of the file
                const fileContent = [
                    '---',
                    'type: transcript',
                    `created: ${new Date().toISOString()}`,
                    '---',
                    '',
                    '# Video Transcript',
                    '',
                    context.content
                ].join('\n');
                
                await plugin.app.vault.create(filename, fileContent);
                new Notice(`Transcript saved to ${filename}`);
            } else {
                // Generic save implementation
                const plugin = context.plugin as SkribePlugin;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `${plugin.settings.transcriptFolder}/content-${timestamp}.md`;
                
                await plugin.app.vault.create(filename, context.content);
                new Notice(`Content saved to ${filename}`);
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
            
            // Check if we're in a TranscriptionView
            if (context.view && context.view.constructor.name === 'TranscriptionView') {
                console.log('format-ai: Calling enhanceWithAI directly on TranscriptionView');
                
                // Call the enhanceWithAI method directly
                await context.view.enhanceWithAI();
            } else {
                console.log('format-ai: Not a TranscriptionView, using fallback approach');
                
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