import { YouTubeService } from '../services/YouTubeService';
import 'jest';

// Mock the requestUrl function
jest.mock('obsidian', () => ({
  requestUrl: jest.fn()
}));

describe('YouTubeService', () => {
    let youtubeService: YouTubeService;

    beforeAll(() => {
        youtubeService = YouTubeService.getInstance();
    });

    describe('cleanYouTubeUrl', () => {
        it('should keep standard YouTube URLs with v parameter intact', () => {
            const url = 'https://www.youtube.com/watch?v=Ek9w4p9yMqk';
            expect(youtubeService.cleanYouTubeUrl(url)).toEqual(url);
        });

        it('should keep short youtu.be URLs intact', () => {
            const url = 'https://youtu.be/iao88x_uh';
            expect(youtubeService.cleanYouTubeUrl(url)).toEqual(url);
        });

        it('should keep short youtu.be URLs with t parameter intact', () => {
            const url = 'https://youtu.be/iao88x_uhZw?t=3626';
            expect(youtubeService.cleanYouTubeUrl(url)).toEqual(url);
        });

        it('should keep standard YouTube URLs with v parameter intact', () => {
            const url = 'https://www.youtube.com/watch?v=_R_Vc17mxNE';
            expect(youtubeService.cleanYouTubeUrl(url)).toEqual(url);
        });

        it('should remove si parameter from short youtu.be URLs', () => {
            const input = 'https://youtu.be/qkFYqY3vr84?si=PC8yS3jyTXU0_S4_';
            const expected = 'https://youtu.be/qkFYqY3vr84';
            expect(youtubeService.cleanYouTubeUrl(input)).toEqual(expected);
        });

        it('should keep t parameter but remove other parameters from short youtu.be URLs', () => {
            const input = 'https://youtu.be/X2VGzVMSjPg?si=kepUNGcmp3dzr3Xb&t=311';
            const expected = 'https://youtu.be/X2VGzVMSjPg?t=311';
            expect(youtubeService.cleanYouTubeUrl(input)).toEqual(expected);
        });

        it('should handle standard YouTube URLs with multiple parameters', () => {
            const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abcdefg12345&list=PLxyz';
            const expected = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
            expect(youtubeService.cleanYouTubeUrl(input)).toEqual(expected);
        });

        it('should preserve t parameter but remove others in standard YouTube URLs', () => {
            const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42&si=abcdefg12345';
            const expected = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42';
            expect(youtubeService.cleanYouTubeUrl(input)).toEqual(expected);
        });

        it('should handle empty URL', () => {
            const url = '';
            expect(youtubeService.cleanYouTubeUrl(url)).toEqual(url);
        });

        it('should handle URLs with no video ID', () => {
            const url = 'https://www.youtube.com/feed/subscriptions';
            expect(youtubeService.cleanYouTubeUrl(url)).toEqual(url);
        });

        it('should return original URL if not a recognized YouTube URL format', () => {
            const url = 'https://example.com/video';
            expect(youtubeService.cleanYouTubeUrl(url)).toEqual(url);
        });
    });
}); 