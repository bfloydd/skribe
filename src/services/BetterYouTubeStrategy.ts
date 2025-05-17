import { VideoInputStrategy } from './VideoInputStrategy';
import { YouTubeService } from './YouTubeService';
import { Notice } from 'obsidian';

export class BetterYouTubeStrategy implements VideoInputStrategy {
    private youtubeService = YouTubeService.getInstance();

    async getTranscripts(input: string): Promise<{ transcript: string, title: string }[]> {
        const videoLinks = input.split(',').map(link => link.trim());
        console.log(`Processing ${videoLinks.length} video links`);
        
        const transcripts = [];
        const failedVideos: {link: string, reason: string}[] = [];
        
        // Process videos one at a time with a delay between them to avoid rate limiting
        for (let i = 0; i < videoLinks.length; i++) {
            const link = videoLinks[i];
            console.log(`Processing link ${i+1}/${videoLinks.length}: ${link}`);
            
            if (!this.youtubeService.isYouTubeUrl(link)) {
                console.error(`Invalid YouTube URL: ${link}`);
                failedVideos.push({link, reason: 'Invalid YouTube URL format'});
                continue;
            }

            const videoId = this.youtubeService.extractVideoId(link);
            if (!videoId) {
                console.error(`Could not extract video ID from the URL: ${link}`);
                failedVideos.push({link, reason: 'Could not extract video ID'});
                continue;
            }

            // Add a much longer delay between processing each video (increased to 8-12 seconds)
            if (i > 0) {
                const waitTime = 8000 + Math.floor(Math.random() * 4000); // 8-12 seconds
                new Notice(`Waiting ${Math.round(waitTime/1000)} seconds before fetching next video...`);
                console.log(`Waiting ${waitTime/1000} seconds before processing next video...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            let attempts = 0;
            const maxAttempts = 5; // Increased from 3 to 5
            let success = false;
            
            while (attempts < maxAttempts && !success) {
                try {
                    // Show a notice for the attempt
                    if (attempts > 0) {
                        new Notice(`Retrying video ${i+1}/${videoLinks.length}, attempt ${attempts+1}/${maxAttempts}`);
                    } else {
                        new Notice(`Fetching transcript for video ${i+1}/${videoLinks.length}`);
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
                            link, 
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
            new Notice(`Warning: Successfully fetched ${transcripts.length} out of ${videoLinks.length} transcripts`);
        } else {
            new Notice(`Successfully fetched all ${transcripts.length} transcripts`);
        }

        console.log(`Successfully fetched ${transcripts.length} out of ${videoLinks.length} transcripts`);
        return transcripts;
    }
} 