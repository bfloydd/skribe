import { VideoInputStrategy } from './VideoInputStrategy';
import { YouTubeService } from './YouTubeService';
import { Notice } from 'obsidian';
import { requestUrl } from 'obsidian';

export class YouTubePlaylistStrategy implements VideoInputStrategy {
    private youtubeService = YouTubeService.getInstance();

    async getTranscripts(input: string): Promise<{ transcript: string, title: string }[]> {
        // Validate if the input is a YouTube playlist URL
        if (!this.isYouTubePlaylistUrl(input)) {
            throw new Error('Invalid YouTube playlist URL');
        }

        // Extract playlist ID
        const playlistId = this.extractPlaylistId(input);
        if (!playlistId) {
            throw new Error('Could not extract playlist ID from the URL');
        }

        new Notice(`Fetching videos from playlist: ${playlistId}`);
        
        // Get all video IDs from the playlist
        const videoIds = await this.getVideoIdsFromPlaylist(playlistId);
        
        if (videoIds.length === 0) {
            throw new Error('No videos found in the playlist or failed to extract video IDs');
        }

        new Notice(`Found ${videoIds.length} videos in the playlist`);
        
        // Process videos to get transcripts
        const transcripts = [];
        const failedVideos: {id: string, reason: string}[] = [];
        
        // Process videos one at a time with a delay between them to avoid rate limiting
        for (let i = 0; i < videoIds.length; i++) {
            const videoId = videoIds[i];
            console.log(`Processing video ${i+1}/${videoIds.length}: ${videoId}`);
            
            // Add a much longer delay between processing each video (increased to 8-12 seconds)
            if (i > 0) {
                const waitTime = 8000 + Math.floor(Math.random() * 4000); // 8-12 seconds
                new Notice(`Waiting ${Math.round(waitTime/1000)} seconds before fetching next video...`);
                console.log(`Waiting ${waitTime/1000} seconds before processing next video...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            let attempts = 0;
            const maxAttempts = 5; // Same as BetterYouTubeStrategy
            let success = false;
            
            while (attempts < maxAttempts && !success) {
                try {
                    // Show a notice for the attempt
                    if (attempts > 0) {
                        new Notice(`Retrying video ${i+1}/${videoIds.length}, attempt ${attempts+1}/${maxAttempts}`);
                    } else {
                        new Notice(`Fetching transcript for video ${i+1}/${videoIds.length}`);
                    }
                    
                    const { transcript, title } = await this.youtubeService.getTranscript(videoId);
                    
                    // Check if we actually received usable content
                    if (!transcript || transcript.trim().length < 100) {
                        throw new Error('Received empty or very short transcript');
                    }
                    
                    console.log(`Fetched transcript for video: "${title}" (ID: ${videoId}) - ${transcript.length} characters`);
                    transcripts.push({ transcript, title });
                    success = true;
                    new Notice(`Successfully fetched transcript for "${title}"`);
                } catch (error) {
                    attempts++;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`Error fetching transcript for video ID: ${videoId}, attempt ${attempts}/${maxAttempts}`, error);
                    
                    if (attempts < maxAttempts) {
                        // Wait longer between retries (exponential backoff)
                        const waitTime = Math.pow(2, attempts) * 3000; // Longer delays (3s, 6s, 12s, 24s, 48s)
                        new Notice(`Error: ${errorMessage}. Retrying in ${Math.round(waitTime/1000)} seconds...`);
                        console.log(`Waiting ${waitTime/1000} seconds before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                        console.error(`Failed to fetch transcript after ${maxAttempts} attempts for video ID: ${videoId}`);
                        new Notice(`Failed to fetch transcript after ${maxAttempts} attempts: ${errorMessage}`);
                        failedVideos.push({
                            id: videoId, 
                            reason: errorMessage.includes('Empty response') 
                                ? 'YouTube API rate limit or no transcripts available' 
                                : errorMessage
                        });
                    }
                }
            }
        }

        // Handle results
        if (transcripts.length === 0) {
            if (failedVideos.length > 0) {
                const errorMessage = `Failed to fetch any transcripts. Reason: ${failedVideos[0].reason}`;
                new Notice(errorMessage);
                throw new Error(errorMessage);
            } else {
                const errorMessage = 'Failed to fetch any transcripts for unknown reasons';
                new Notice(errorMessage);
                throw new Error(errorMessage);
            }
        } else if (failedVideos.length > 0) {
            new Notice(`Warning: Successfully fetched ${transcripts.length} out of ${videoIds.length} transcripts`);
        } else {
            new Notice(`Successfully fetched all ${transcripts.length} transcripts`);
        }

        console.log(`Successfully fetched ${transcripts.length} out of ${videoIds.length} transcripts`);
        return transcripts;
    }

    /**
     * Check if the given URL is a YouTube playlist URL
     */
    private isYouTubePlaylistUrl(url: string): boolean {
        const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com)\/playlist\?list=.+$/;
        return pattern.test(url);
    }

    /**
     * Extract playlist ID from a YouTube playlist URL
     */
    private extractPlaylistId(url: string): string | null {
        try {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('list');
        } catch (error) {
            console.error('Error parsing playlist URL:', error);
            return null;
        }
    }

    /**
     * Fetch all video IDs from a YouTube playlist
     */
    private async getVideoIdsFromPlaylist(playlistId: string): Promise<string[]> {
        try {
            // Fetch the playlist page
            const response = await requestUrl({
                url: `https://www.youtube.com/playlist?list=${playlistId}`,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                }
            });

            // Look for the initial data variable that contains playlist information
            const initialDataMatch = response.text.match(/var\s+ytInitialData\s*=\s*({.+?});\s*<\/script/);
            if (!initialDataMatch) {
                throw new Error('Could not find playlist data');
            }

            try {
                const initialData = JSON.parse(initialDataMatch[1]);
                
                // Extract video IDs from the playlist data
                // The exact path to video IDs may vary based on YouTube's structure
                const videoItems = this.findVideoItemsInData(initialData);
                
                if (!videoItems || videoItems.length === 0) {
                    throw new Error('No videos found in playlist data');
                }
                
                // Extract video IDs
                const videoIds = videoItems.map(item => this.extractVideoIdFromPlaylistItem(item)).filter(id => id !== null);
                
                return videoIds as string[];
            } catch (parseError) {
                console.error('Error parsing playlist data:', parseError);
                throw new Error('Failed to parse playlist data');
            }
        } catch (error) {
            console.error('Error fetching playlist data:', error);
            throw error;
        }
    }

    /**
     * Find video items in the YouTube initial data
     */
    private findVideoItemsInData(data: any): any[] {
        // Try to locate the video items in different possible paths
        try {
            const contents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;
            
            if (contents && Array.isArray(contents)) {
                return contents;
            }
            
            // Alternative path for newer YouTube structure
            const altContents = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents;
            
            if (altContents && Array.isArray(altContents)) {
                return altContents.filter(item => item.richItemRenderer?.content?.videoRenderer);
            }
            
            return [];
        } catch (error) {
            console.error('Error finding video items in data:', error);
            return [];
        }
    }

    /**
     * Extract video ID from a playlist item
     */
    private extractVideoIdFromPlaylistItem(item: any): string | null {
        try {
            // Try different possible paths to video ID
            if (item.playlistVideoRenderer?.videoId) {
                return item.playlistVideoRenderer.videoId;
            }
            
            if (item.richItemRenderer?.content?.videoRenderer?.videoId) {
                return item.richItemRenderer.content.videoRenderer.videoId;
            }
            
            if (item.videoRenderer?.videoId) {
                return item.videoRenderer.videoId;
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting video ID from playlist item:', error);
            return null;
        }
    }
} 