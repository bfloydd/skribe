import { YouTubeService } from './YouTubeService';

export interface VideoInputStrategy {
    getTranscripts(input: string): Promise<{ transcript: string, title: string }[]>;
}

export class SingleYouTubeVideoStrategy implements VideoInputStrategy {
    private youtubeService = YouTubeService.getInstance();

    async getTranscripts(input: string): Promise<{ transcript: string, title: string }[]> {
        if (!this.youtubeService.isYouTubeUrl(input)) {
            throw new Error('Invalid YouTube URL');
        }

        const videoId = this.youtubeService.extractVideoId(input);
        if (!videoId) {
            throw new Error('Could not extract video ID from the URL');
        }

        const { transcript, title } = await this.youtubeService.getTranscript(videoId);
        return [{ transcript, title }];
    }
}

export class CommaSeparatedYouTubeVideosStrategy implements VideoInputStrategy {
    private youtubeService = YouTubeService.getInstance();

    async getTranscripts(input: string): Promise<{ transcript: string, title: string }[]> {
        const videoLinks = input.split(',').map(link => link.trim());
        console.log(`Processing ${videoLinks.length} video links`);
        
        const transcripts = [];

        for (const link of videoLinks) {
            console.log(`Processing link: ${link}`);
            if (!this.youtubeService.isYouTubeUrl(link)) {
                console.error(`Invalid YouTube URL: ${link}`);
                continue;
            }

            const videoId = this.youtubeService.extractVideoId(link);
            if (!videoId) {
                console.error(`Could not extract video ID from the URL: ${link}`);
                continue;
            }

            let attempts = 0;
            const maxAttempts = 3;
            while (attempts < maxAttempts) {
                try {
                    const { transcript, title } = await this.youtubeService.getTranscript(videoId);
                    console.log(`Fetched transcript for video: "${title}" (ID: ${videoId})`);
                    transcripts.push({ transcript, title });
                    break;
                } catch (error) {
                    attempts++;
                    console.error(`Error fetching transcript for video ID: ${videoId}, attempt ${attempts}`, error);
                    if (attempts >= maxAttempts) {
                        console.error(`Failed to fetch transcript after ${maxAttempts} attempts for video ID: ${videoId}`);
                    }
                }
            }
        }

        console.log(`Successfully fetched ${transcripts.length} out of ${videoLinks.length} transcripts`);
        return transcripts;
    }
} 