 # Skribe Plugin Tests

This README provides instructions on how to run tests for the Skribe plugin.

## Setup

The testing environment uses Jest with TypeScript support. Make sure you have all the dependencies installed:

```bash
npm install
```

This will install the required packages including:
- jest
- ts-jest 
- @types/jest

## Running Tests

You can run all tests with:

```bash
npm test
```

### Running Specific Tests

To run a specific test file:

```bash
npm test -- src/tests/YouTubeService.test.ts
```

To run tests with a specific name pattern:

```bash
npm test -- -t "cleanYouTubeUrl"
```

## Test Structure

The tests are organized in the `src/tests` directory:

- `src/tests/YouTubeService.test.ts` - Tests for the YouTube URL cleaning functionality
- `src/tests/mocks/obsidianMock.ts` - Mocks for Obsidian API

## Writing New Tests

When writing new tests:

1. Create a new test file in the `src/tests` directory with a `.test.ts` extension
2. Import the necessary dependencies and mocks
3. Use the Jest testing framework functions: `describe`, `it`, `expect`, etc.

Example:

```typescript
import { MyService } from '../services/MyService';
import 'jest';

describe('MyService', () => {
  let service: MyService;
  
  beforeEach(() => {
    service = new MyService();
  });
  
  it('should do something', () => {
    expect(service.doSomething()).toBe(true);
  });
});
```

## Mocking Dependencies

For Obsidian API dependencies, use the mocks in `src/tests/mocks/obsidianMock.ts`.