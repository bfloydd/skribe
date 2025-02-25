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
            return !!context.content && 
                   !!context.plugin?.settings?.openaiApiKey;
        },
        execute: async (context: CommandContext) => {
            if (!context.content || !context.view) return;
            
            // Use a generic approach since reformatWithAI is private
            new Notice('AI formatting in progress...');
            const plugin = context.plugin as SkribePlugin;
            
            try {
                // Use the OpenAI service's reformatText method
                const formattedContent = await plugin.openaiService.reformatText(context.content);
                
                // Update the content in the context
                context.content = formattedContent;
                
                // If the view has a setContent method, use it
                if (typeof context.view.setContent === 'function') {
                    context.view.setContent(formattedContent);
                }
                
                new Notice('Content enhanced with AI');
            } catch (error) {
                console.error('AI formatting error:', error);
                new Notice(`AI formatting error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        execute: command.execute
    };
} 