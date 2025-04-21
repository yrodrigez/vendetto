import { type Message } from "../../delivery";
import { findUrls } from "../../delivery/findUrls";

describe('findUrls', () => {
  test('returns empty array when no URLs are present', () => {
    const message: Message = {
      content: 'This is a regular message with no links',
      targetMapping: { targetName: 'user' }
    };
    expect(findUrls(message)).toEqual([]);
  });

  test('finds a single http URL', () => {
    const message: Message = {
      content: 'Check out http://example.com for more info',
      targetMapping: { targetName: 'user' }
    };
    expect(findUrls(message)).toEqual(['http://example.com']);
  });

  test('finds a single https URL', () => {
    const message: Message = {
      content: 'Visit https://secure-site.com for secure content',
      targetMapping: { targetName: 'user' }
    };
    expect(findUrls(message)).toEqual(['https://secure-site.com']);
  });

  test('finds multiple URLs in content', () => {
    const message: Message = {
      content: 'Visit https://example.com and http://another-site.org for resources',
      targetMapping: { targetName: 'user' }
    };
    expect(findUrls(message)).toEqual(['https://example.com', 'http://another-site.org']);
  });

  test('finds URLs with paths and query parameters', () => {
    const message: Message = {
      content: 'Sign up at https://app.example.com/signup?ref=123',
      targetMapping: { targetName: 'user' }
    };
    expect(findUrls(message)).toEqual(['https://app.example.com/signup?ref=123']);
  });

  test('finds URLs at different positions in text', () => {
    const message: Message = {
      content: 'http://start.com is at beginning, middle has https://middle.org, and at end http://end.net',
      targetMapping: { targetName: 'user' }
    };
    const urls = findUrls(message);

    expect(urls).toEqual([
      'http://start.com',
      'https://middle.org',
      'http://end.net'
    ]);
  });

  test('finds URLs inside markdown links', () => {
    const message: Message = {
      content: 'Click [here](https://example.com) to visit our site',
      targetMapping: { targetName: 'user' }
    };
    expect(findUrls(message)).toEqual(['https://example.com']);
  });
  describe('findUrls with query parameters', () => {
    test('finds URLs with simple query parameters', () => {
      const message: Message = {
        content: 'Check this: https://example.com?param=value',
        targetMapping: { targetName: 'user' }
      };
      expect(findUrls(message)).toEqual(['https://example.com?param=value']);
    });

    test('finds URLs with multiple query parameters', () => {
      const message: Message = {
        content: 'Link: https://api.example.com/search?q=test&page=1&limit=10',
        targetMapping: { targetName: 'user' }
      };
      expect(findUrls(message)).toEqual(['https://api.example.com/search?q=test&page=1&limit=10']);
    });

    test('finds URLs with special characters in query parameters', () => {
      const message: Message = {
        content: 'Complex URL: https://example.com/path?q=test+query&filter[]=value1&filter[]=value2',
        targetMapping: { targetName: 'user' }
      };
      expect(findUrls(message)).toEqual(['https://example.com/path?q=test+query&filter[]=value1&filter[]=value2']);
    });

    test('finds URLs with fragments after query parameters', () => {
      const message: Message = {
        content: 'URL with fragment: https://example.com/page?id=123#section2',
        targetMapping: { targetName: 'user' }
      };
      expect(findUrls(message)).toEqual(['https://example.com/page?id=123#section2']);
    });
  });
});