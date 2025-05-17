import { Notice } from 'obsidian';
import { BetterYouTubeStrategy } from '../services/BetterYouTubeStrategy';
import { VideoInputStrategy } from '../services/VideoInputStrategy';
import { YouTubeService } from '../services/YouTubeService';
import type SkribePlugin from '../../main';

/**
 * TranscriptManager handles all operations related to fetching and managing transcripts
 * It encapsulates the YouTube fetch logic, processing, and interactions with the view
 */
export class TranscriptManager {
    private plugin: SkribePlugin;
    private youtubeService: YouTubeService;
    private static instance: TranscriptManager;

    private constructor(plugin: SkribePlugin) {
        this.plugin = plugin;
        this.youtubeService = YouTubeService.getInstance();
    }

    /**
     * Get the singleton instance of TranscriptManager
     */
    public static getInstance(plugin: SkribePlugin): TranscriptManager {
        if (!TranscriptManager.instance) {
            TranscriptManager.instance = new TranscriptManager(plugin);
        }
        return TranscriptManager.instance;
    }

    /**
     * Fetches transcripts from a URL input string
     * @param input URL or comma-separated URLs to fetch transcripts from
     * @returns An array of transcript objects
     */
    private async fetchTranscripts(input: string): Promise<{ transcript: string, title: string }[]> {
        // Use BetterYouTubeStrategy for improved error handling and rate limiting
        const strategy: VideoInputStrategy = new BetterYouTubeStrategy();
        console.log('Using BetterYouTubeStrategy for input:', input);
        
        return await strategy.getTranscripts(input);
    }

    /**
     * Fetches transcripts, resets the view, and adds them
     * This is used when starting fresh with new transcripts
     * @param input URL or comma-separated URLs to fetch transcripts from
     */
    public async fetchAndResetView(input: string): Promise<void> {
        try {
            const transcripts = await this.fetchTranscripts(input);
            console.log('Fetched transcripts:', transcripts.length);
            
            const view = await this.plugin.activateView();
            if (view) {
                // First, reset the view to start fresh
                if (transcripts.length > 0) {
                    console.log('Resetting view and adding transcripts');
                    view.resetView();
                    
                    // Get an array of individual URLs from the input (for multiple comma-separated URLs)
                    const urls = input.split(',').map(url => url.trim());
                    
                    // Now add each transcript with its corresponding URL
                    for (let i = 0; i < transcripts.length; i++) {
                        // Use the corresponding URL if available, otherwise use the first URL
                        const videoUrl = i < urls.length ? urls[i] : urls[0];
                        
                        console.log(`Adding transcript ${i+1}:`, {
                            title: transcripts[i].title,
                            contentLength: transcripts[i].transcript.length,
                            url: videoUrl
                        });
                        
                        // Use our TranscriptManager method to add the transcript
                        await this.addTranscript(
                            transcripts[i].transcript, 
                            videoUrl, 
                            transcripts[i].title,
                            view
                        );
                    }
                    
                    // Switch to the first transcript using our TranscriptManager method
                    if (transcripts.length > 0) {
                        await this.switchToTranscriptTab(0);
                        console.log('Switched to first transcript tab');
                    }
                    
                    // Show success notice
                    new Notice(`Loaded ${transcripts.length} transcript${transcripts.length > 1 ? 's' : ''}`);
                }
            } else {
                new Notice('Failed to open Skribe view');
            }
        } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Unknown error occurred');
            console.error('Skribe Transcript Error:', error);
        }
    }

    /**
     * Fetches transcripts and adds them to the existing view without resetting
     * This is used when adding more transcripts to an existing view
     * @param input URL or comma-separated URLs to fetch transcripts from
     */
    public async fetchAndAddToExisting(input: string): Promise<void> {
        try {
            const transcripts = await this.fetchTranscripts(input);
            console.log('Fetched transcripts to add to existing:', transcripts.length);
            
            const view = await this.plugin.activateView();
            if (view) {
                if (transcripts.length > 0) {
                    // Get an array of individual URLs from the input (for multiple comma-separated URLs)
                    const urls = input.split(',').map(url => url.trim());
                    
                    // Now add each transcript with its corresponding URL
                    for (let i = 0; i < transcripts.length; i++) {
                        // Use the corresponding URL if available, otherwise use the first URL
                        const videoUrl = i < urls.length ? urls[i] : urls[0];
                        
                        console.log(`Adding additional transcript ${i+1}:`, {
                            title: transcripts[i].title,
                            contentLength: transcripts[i].transcript.length,
                            url: videoUrl
                        });
                        
                        // Use our TranscriptManager method to add the transcript
                        await this.addTranscript(
                            transcripts[i].transcript, 
                            videoUrl, 
                            transcripts[i].title,
                            view
                        );
                    }
                    
                    // Switch to the newly added transcript using our TranscriptManager method
                    const newIndex = view.transcripts.length - 1;
                    if (newIndex >= 0) {
                        await this.switchToTranscriptTab(newIndex);
                        console.log('Switched to newly added transcript tab');
                    }
                    
                    // Show success notice
                    new Notice(`Added ${transcripts.length} new transcript${transcripts.length > 1 ? 's' : ''}`);
                }
            } else {
                new Notice('Failed to open Skribe view');
            }
        } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Unknown error occurred');
            console.error('Skribe Transcript Error:', error);
        }
    }

    /**
     * Validate a YouTube URL and extract video ID
     * @param url The URL to validate
     * @returns True if valid, false otherwise
     */
    public isValidYoutubeUrl(url: string): boolean {
        return this.youtubeService.isYouTubeUrl(url) && 
               !!this.youtubeService.extractVideoId(url);
    }

    /**
     * Fetches a transcript without adding it to the view
     * This is useful for operations like saving to a file without showing in the UI
     * @param url URL of the video to fetch transcript for
     * @returns The first transcript found for the URL
     */
    public async getFetchedTranscript(url: string): Promise<{ transcript: string, title: string }> {
        const transcripts = await this.fetchTranscripts(url);
        
        if (!transcripts || transcripts.length === 0) {
            throw new Error('No transcript found for this video');
        }
        
        // Return the first transcript
        return transcripts[0];
    }

    /**
     * Adds a transcript to the view
     * @param content The transcript content
     * @param url The source URL
     * @param title The title of the transcript
     * @param view Optional view instance (if not provided, will be retrieved from plugin)
     */
    public async addTranscript(content: string, url: string, title: string, view?: any): Promise<void> {
        // Get the view if not provided
        if (!view) {
            view = await this.plugin.activateView();
            if (!view) {
                new Notice('Failed to open Skribe view');
                return;
            }
        }
        
        console.log(`TranscriptManager: Adding transcript: "${title}" (${content.length} characters)`);
        
        // Call the view's addTranscript method
        view.addTranscript(content, url, title);
    }

    /**
     * Removes a transcript tab and its associated data
     * @param index The index of the transcript to remove
     * @param skipConfirmation Set to true to skip the confirmation dialog
     */
    public async removeTranscriptTab(index: number, skipConfirmation = false): Promise<void> {
        const view = await this.plugin.activateView();
        if (!view) {
            new Notice('Failed to open Skribe view');
            return;
        }
        
        // Call the view's removeTranscriptTab method
        // The view handles all the UI updates and state management
        if (skipConfirmation) {
            // Create a backup of the original method
            const originalRemoveTranscriptTab = view.removeTranscriptTab.bind(view);
            
            // Override the method temporarily to skip confirmation
            view.removeTranscriptTab = function(idx: number) {
                console.log(`TranscriptManager: Removing transcript at index ${idx} (skipping confirmation)`);
                
                // Get the transcripts array
                if (idx >= 0 && idx < this.transcripts.length) {
                    // Remove from transcript array
                    this.transcripts.splice(idx, 1);
                    
                    // Remove associated data
                    const revisedContent = { ...this.revisedContents };
                    delete revisedContent[idx];
                    
                    const summaryContent = { ...this.summaryContents };
                    delete summaryContent[idx];
                    
                    const chatStates = { ...this.chatStates };
                    delete chatStates[idx];
                    
                    // Rebuild the contents objects with corrected indices
                    this.revisedContents = {};
                    this.summaryContents = {};
                    this.chatStates = {};
                    
                    // Shift all data to fill in the gap
                    Object.keys(revisedContent).forEach(key => {
                        const keyNum = parseInt(key);
                        if (keyNum > idx) {
                            this.revisedContents[keyNum - 1] = revisedContent[keyNum];
                        } else if (keyNum < idx) {
                            this.revisedContents[keyNum] = revisedContent[keyNum];
                        }
                    });
                    
                    Object.keys(summaryContent).forEach(key => {
                        const keyNum = parseInt(key);
                        if (keyNum > idx) {
                            this.summaryContents[keyNum - 1] = summaryContent[keyNum];
                        } else if (keyNum < idx) {
                            this.summaryContents[keyNum] = summaryContent[keyNum];
                        }
                    });
                    
                    Object.keys(chatStates).forEach(key => {
                        const keyNum = parseInt(key);
                        if (keyNum > idx) {
                            this.chatStates[keyNum - 1] = chatStates[keyNum];
                        } else if (keyNum < idx) {
                            this.chatStates[keyNum] = chatStates[keyNum];
                        }
                    });
                    
                    // Update the combined content for backward compatibility
                    this.updateCombinedContent();
                    
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
                    console.error(`Invalid transcript index: ${idx}`);
                }
            }.bind(view);
            
            // Call the modified method
            view.removeTranscriptTab(index);
            
            // Restore the original method
            view.removeTranscriptTab = originalRemoveTranscriptTab;
        } else {
            console.log(`TranscriptManager: Removing transcript at index ${index} (with confirmation)`);
            view.removeTranscriptTab(index);
        }
    }

    /**
     * Switches to a specific transcript tab
     * @param index The index of the transcript to switch to
     */
    public async switchToTranscriptTab(index: number): Promise<void> {
        const view = await this.plugin.activateView();
        if (!view) {
            new Notice('Failed to open Skribe view');
            return;
        }
        
        console.log(`TranscriptManager: Switching to transcript tab ${index}`);
        
        // Call the view's switchToTranscriptTab method
        view.switchToTranscriptTab(index);
    }

    /**
     * Updates the combined content for backward compatibility
     * @param view Optional view instance
     */
    public async updateCombinedContent(view?: any): Promise<void> {
        // Get the view if not provided
        if (!view) {
            view = await this.plugin.activateView();
            if (!view) {
                console.error('Failed to open Skribe view for updateCombinedContent');
                return;
            }
        }
        
        console.log('TranscriptManager: Updating combined content');
        
        // Get the transcripts array from the view
        const transcripts = view.transcripts;
        if (!transcripts || !Array.isArray(transcripts)) {
            console.error('Invalid transcripts array in view');
            return;
        }
        
        // Update the combined content
        view.content = transcripts.map((t: any, index: number) => {
            const header = index === 0 ? '' : `\n\n${'='.repeat(40)}\n${t.title || 'Video ' + (index + 1)}\n${'='.repeat(40)}\n\n`;
            return header + t.content;
        }).join('');
    }
} 