import { request, requestUrl } from 'obsidian';
import { parseVideoPageWithFallbacks, parseTranscript } from '../utils/YouTubeApiParser';

export class YouTubeService {
    private static instance: YouTubeService;

    private constructor() {}

    public static getInstance(): YouTubeService {
        if (!YouTubeService.instance) {
            YouTubeService.instance = new YouTubeService();
        }
        return YouTubeService.instance;
    }

    public isYouTubeUrl(url: string): boolean {
        const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        return pattern.test(url);
    }

    public extractVideoId(url: string): string | null {
        const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    public async getTranscript(videoId: string): Promise<{ transcript: string, title: string }> {
        try {
            const url = `https://www.youtube.com/watch?v=${videoId}`;
            const videoPageBody = await request(url);
            const videoData = parseVideoPageWithFallbacks(videoPageBody);

            console.log(
                `🚀 DEBUG: Starting transcript fetch with ${videoData.transcriptRequests.length} different parameter combinations`,
            );

            // Try each parameter combination until one succeeds
            for (let i = 0; i < videoData.transcriptRequests.length; i++) {
                const transcriptRequest = videoData.transcriptRequests[i];

                // Extract and show params info
                let paramsInfo = "UNKNOWN";
                let paramsSource = "UNKNOWN";
                try {
                    const requestBodyObj = JSON.parse(transcriptRequest.body);
                    const currentParams = requestBodyObj.params;
                    if (i === 0 && videoData.title) {
                        // First attempt - check if this might be page params
                        paramsSource =
                            currentParams && currentParams.length > 50
                                ? "PAGE"
                                : "GENERATED";
                    } else {
                        paramsSource = "GENERATED";
                    }
                    paramsInfo = `${currentParams.substring(0, 30)}... (${currentParams.length} chars)`;
                } catch (parseError) {
                    paramsInfo = "PARSE_ERROR";
                }

                try {
                    console.log(
                        `🎯 Attempt ${i + 1}/${videoData.transcriptRequests.length}: Trying ${paramsSource} params: ${paramsInfo}`,
                    );

                    const response = await requestUrl({
                        url: transcriptRequest.url,
                        method: "POST",
                        headers: transcriptRequest.headers,
                        body: transcriptRequest.body,
                    });

                    const lines = parseTranscript(response.text);

                    // If we got valid transcript lines, return success
                    if (lines && lines.length > 0) {
                        console.log(
                            `✅ SUCCESS on attempt ${i + 1}: Found ${lines.length} transcript lines using ${paramsSource} params!`,
                        );
                        
                        // Convert lines to transcript text
                        const transcript = lines.map((line: { text: string }) => line.text).join(' ');
                        return {
                            title: videoData.title,
                            transcript,
                        };
                    } else {
                        console.log(
                            `❌ Attempt ${i + 1} failed: No transcript lines returned (empty response)`,
                        );
                    }
                } catch (requestError: any) {
                    console.log(
                        `❌ Attempt ${i + 1} failed: ${requestError.message}`,
                    );
                    // Continue to next attempt unless this was the last one
                    if (i === videoData.transcriptRequests.length - 1) {
                        throw requestError;
                    }
                }
            }

            throw new Error("All parameter combinations failed to fetch transcript");
        } catch (err: any) {
            console.error('Error fetching transcript:', err);
            throw err;
        }
    }



    public extractVideoIdForFilename(url: string): string {
        // Extract the video ID using the main method
        const videoId = this.extractVideoId(url);
        
        // Return the video ID if found, otherwise empty string
        return videoId || '';
    }

    /**
     * Clean a YouTube URL to keep only v and t parameters
     * @param url The YouTube URL to clean
     * @returns A clean YouTube URL with only v and t parameters
     */
    public cleanYouTubeUrl(url: string): string {
        if (!url) return url;
        
        try {
            // Handle youtu.be URLs
            if (url.includes('youtu.be/')) {
                const videoId = this.extractVideoId(url);
                if (!videoId) return url; // If no video ID found, return original URL
                
                // Parse the URL to get the time parameter
                const urlObj = new URL(url);
                const timeParam = urlObj.searchParams.get('t');
                
                // Construct the clean URL
                return timeParam 
                    ? `https://youtu.be/${videoId}?t=${timeParam}` 
                    : `https://youtu.be/${videoId}`;
            } 
            // Handle youtube.com URLs
            else if (url.includes('youtube.com/watch')) {
                const videoId = this.extractVideoId(url);
                if (!videoId) return url; // If no video ID found, return original URL
                
                // Parse the URL to get the time parameter
                const urlObj = new URL(url);
                const timeParam = urlObj.searchParams.get('t');
                
                // Construct the clean URL
                return timeParam 
                    ? `https://www.youtube.com/watch?v=${videoId}&t=${timeParam}` 
                    : `https://www.youtube.com/watch?v=${videoId}`;
            }
            
            // If not a recognized format, return original URL
            return url;
        } catch (error) {
            console.error('Error cleaning YouTube URL:', error);
            return url; // Return original URL in case of errors
        }
    }
}