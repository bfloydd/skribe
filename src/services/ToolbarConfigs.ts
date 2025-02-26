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
        isEnabled: () => true, // Always enabled
        execute: (context: CommandContext) => {
            if (context.view && typeof context.view.resetView === 'function') {
                context.view.resetView();
                new Notice('Starting over');
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
    // Note: The "Enhance with AI" button is implemented directly in TranscriptionView.ts
    // instead of using the common format-ai command to ensure reliable operation
    
    // Transcript-specific commands
    {
        id: 'play-tts',
        icon: 'play-circle',
        tooltip: 'Play/Pause transcript with TTS',
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

                // Toggle play/pause functionality would be implemented here
                // This would interact with the AudioPlayer service
                new Notice('TTS playback toggled');
            } catch (error) {
                console.error('TTS error:', error);
                new Notice(`TTS error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `${plugin.settings.transcriptFolder}/chat-export-${timestamp}.md`;
                
                // Format chat messages as markdown
                const chatContent = context.chatMessages.map((msg: { role: string; content: string }) => {
                    const role = msg.role === 'user' ? '**You**' : '**Assistant**';
                    return `${role}: ${msg.content}`;
                }).join('\n\n');
                
                // Add metadata
                const fileContent = [
                    '---',
                    'type: chat-export',
                    `created: ${new Date().toISOString()}`,
                    '---',
                    '',
                    '# Chat Export',
                    '',
                    chatContent
                ].join('\n');
                
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