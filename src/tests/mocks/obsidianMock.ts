// This file mocks the minimal Obsidian API requirements for testing

// Mock requestUrl function needed for YouTubeService
export const requestUrl = jest.fn().mockImplementation(async () => {
  return {
    text: '{"events": []}'
  };
});

// Export other Obsidian API mocks as needed
export const Notice = jest.fn();
export const MarkdownView = jest.fn();
export const setIcon = jest.fn();

// Default export for all Obsidian imports
export default {
  requestUrl,
  Notice,
  MarkdownView,
  setIcon
}; 