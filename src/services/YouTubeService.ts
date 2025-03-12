import { requestUrl } from 'obsidian';
import { TranscriptEvent, TranscriptSegment, CaptionTrack } from '../types';

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

    public async getTranscript(videoId: string): Promise<string> {
        try {
            const player = await this.fetchVideoData(videoId);
            const tracks = await this.getCapTracks(player);
            return await this.fetchAndParseTranscript(tracks[0].baseUrl);
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
        
        try {
            const transcriptResponse = await requestUrl({
                url: encodedUrl,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const transcript = JSON.parse(transcriptResponse.text);
            return this.parseTranscript(transcript);
        } catch (error) {
            console.error('Error fetching transcript:', error);
            console.log('Failed URL:', encodedUrl);
            if (error.message.includes('MalformedURI') || error.message.includes('no protocol')) {
                throw new Error('Malformed URL error. This can happen on mobile devices. Please try a different video or check your network connection.');
            }
            throw error;
        }
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
}