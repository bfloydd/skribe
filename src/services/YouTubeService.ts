import { requestUrl } from 'obsidian';
import { TranscriptEvent, TranscriptSegment, CaptionTrack } from '../types/index';

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
            const player = await this.fetchVideoData(videoId);
            const tracks = await this.getCapTracks(player);
            const transcript = await this.fetchAndParseTranscript(tracks[0].baseUrl);
            const title = this.extractVideoTitle(player);
            return { transcript, title };
        } catch (error) {
            console.error('Error fetching transcript:', error);
            throw error;
        }
    }

    private async fetchVideoData(videoId: string): Promise<any> {
        const response = await requestUrl({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            method: 'GET'
        });

        const playerResponseMatch = response.text.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)/);
        if (!playerResponseMatch) {
            throw new Error('Unable to parse player response');
        }

        return JSON.parse(playerResponseMatch[1]);
    }

    private async getCapTracks(player: any): Promise<CaptionTrack[]> {
        const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (!tracks || tracks.length === 0) {
            throw new Error('No captions available for this video');
        }

        tracks.sort(this.compareTracks);
        return tracks;
    }

    private async fetchAndParseTranscript(baseUrl: string): Promise<string> {
        // Check if baseUrl is a relative URL (starts with /)
        let fullUrl = baseUrl;
        if (baseUrl.startsWith('/')) {
            fullUrl = 'https://www.youtube.com' + baseUrl;
        } else if (!baseUrl.startsWith('http')) {
            fullUrl = 'https://' + baseUrl;
        }
        
        // Now encode the parameters correctly
        const urlObj = new URL(fullUrl);
        const params = new URLSearchParams(urlObj.search);
        params.append('fmt', 'json3');
        
        // Rebuild the URL with proper encoding
        const encodedUrl = urlObj.origin + urlObj.pathname + '?' + params.toString();
        
        // Maximum retries
        const maxRetries = 6; // Increased to 6 attempts total
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                console.log(`Fetching transcript (attempt ${retryCount + 1}/${maxRetries}): ${encodedUrl}`);
                
                // Add a random delay between requests to avoid rate limiting
                const randomDelay = 2000 + Math.floor(Math.random() * 3000); // 2-5 seconds
                if (retryCount > 0) {
                    console.log(`Adding random delay of ${randomDelay}ms before request`);
                    await new Promise(resolve => setTimeout(resolve, randomDelay));
                }
                
                const transcriptResponse = await requestUrl({
                    url: encodedUrl,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                        'Accept': 'application/json',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://www.youtube.com/watch',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                // Check if we got a valid response
                if (!transcriptResponse.text || transcriptResponse.text.trim().length === 0) {
                    console.error(`Empty response received for URL: ${encodedUrl}`);
                    throw new Error('Empty response received');
                }
                
                // Try to parse the JSON response
                try {
                    const transcript = JSON.parse(transcriptResponse.text);
                    
                    // Validate that we have the expected structure
                    if (!transcript || !transcript.events || !Array.isArray(transcript.events)) {
                        console.error('Invalid transcript structure:', transcript);
                        throw new Error('Invalid transcript structure');
                    }
                    
                    // Check if the transcript actually contains content
                    if (transcript.events.length === 0) {
                        throw new Error('Transcript contains no content');
                    }
                    
                    // Basic validation check on events - ensure they have segments
                    const hasValidContent = transcript.events.some((event: any) => 
                        event.segs && Array.isArray(event.segs) && event.segs.length > 0
                    );
                    
                    if (!hasValidContent) {
                        throw new Error('Transcript does not contain valid segments');
                    }
                    
                    const parsedText = this.parseTranscript(transcript);
                    if (parsedText.trim().length < 100) {
                        throw new Error('Parsed transcript is too short, likely incomplete');
                    }
                    
                    return parsedText;
                } catch (jsonError) {
                    console.error('JSON parsing error:', jsonError);
                    console.error('Response text:', transcriptResponse.text.substring(0, 200) + '...');
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw new Error('Failed to parse transcript JSON. The response might be incomplete.');
                    }
                    // Wait before retrying (exponential backoff)
                    const backoffTime = Math.pow(2, retryCount) * 2000; // Doubled from 1000
                    console.log(`Waiting ${backoffTime/1000} seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, backoffTime));
                }
            } catch (error) {
                console.error(`Error fetching transcript (attempt ${retryCount + 1}/${maxRetries}):`, error);
                console.log('Failed URL:', encodedUrl);
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    if (error.message.includes('MalformedURI') || error.message.includes('no protocol')) {
                        throw new Error('Malformed URL error. This can happen on mobile devices. Please try a different video or check your network connection.');
                    }
                    
                    if (error.message.includes('Empty response')) {
                        throw new Error('YouTube API returned an empty response. This could be due to rate limiting or the video not having captions.');
                    }
                    
                    throw error;
                }
                
                // Wait before retrying (exponential backoff)
                const backoffTime = Math.pow(2, retryCount) * 3000; // Tripled from 1000
                console.log(`Waiting ${backoffTime/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
        }
        
        throw new Error('Failed to fetch transcript after multiple attempts');
    }

    private parseTranscript(transcript: any): string {
        return transcript.events
            .filter((x: TranscriptEvent) => x.segs)
            .map((x: TranscriptEvent) => {
                return x.segs
                    .map((y: TranscriptSegment) => y.utf8)
                    .join(' ');
            })
            .join(' ')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ');
    }

    private compareTracks(track1: CaptionTrack, track2: CaptionTrack): number {
        const langCode1 = track1.languageCode;
        const langCode2 = track2.languageCode;

        if (langCode1 === 'en' && langCode2 !== 'en') return -1;
        if (langCode1 !== 'en' && langCode2 === 'en') return 1;
        if (track1.kind !== 'asr' && track2.kind === 'asr') return -1;
        if (track1.kind === 'asr' && track2.kind !== 'asr') return 1;
        return 0;
    }

    private extractVideoTitle(player: any): string {
        try {
            return player.videoDetails?.title || 'Unknown Title';
        } catch (error) {
            console.error('Error extracting video title:', error);
            return 'Unknown Title';
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