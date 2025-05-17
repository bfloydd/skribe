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
                        
                        view.addTranscript(transcripts[i].transcript, videoUrl, transcripts[i].title);
                    }
                    
                    // Switch to the first transcript
                    if (transcripts.length > 0) {
                        view.switchToTranscriptTab(0);
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
                        
                        view.addTranscript(transcripts[i].transcript, videoUrl, transcripts[i].title);
                    }
                    
                    // Switch to the newly added transcript
                    const newIndex = view.transcripts.length - 1;
                    if (newIndex >= 0) {
                        view.switchToTranscriptTab(newIndex);
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
} 