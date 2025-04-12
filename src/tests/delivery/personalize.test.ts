import {describe, expect, test, beforeEach, jest} from '@jest/globals';
import Mustache from 'mustache';
import {personalize} from '../../delivery/personalize';

// Mock Mustache
jest.mock('mustache');

describe('personalize', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock implementation
        (Mustache.render as jest.Mock).mockReturnValue('Rendered content');
    });

    // Input validation tests
    test('throws error for invalid member data', () => {
        expect(() => {
            personalize({
                memberData: null as any,
                targetData: {},
                message: {content: 'Hello!', targetMapping: {targetName: 'user'}},
                targetMapping: {targetName: 'user'}
            });
        }).toThrow('Invalid member data');
    });

    test('throws error for invalid target data', () => {
        expect(() => {
            personalize({
                memberData: {},
                targetData: null as any,
                message: {content: 'Hello!', targetMapping: {targetName: 'user'}},
                targetMapping: {targetName: 'user'}
            });
        }).toThrow('Invalid target data');
    });

    test('throws error for invalid target mapping', () => {
        expect(() => {
            personalize({
                memberData: {},
                targetData: {},
                message: {content: 'Hello!', targetMapping: {targetName: 'user'}},
                targetMapping: {targetName: ''}
            });
        }).toThrow('Invalid target mapping');
    });

    test('throws error for invalid message content', () => {
        expect(() => {
            personalize({
                memberData: {},
                targetData: {},
                message: {content: null as any, targetMapping: {targetName: 'user'}},
                targetMapping: {targetName: 'user'}
            });
        }).toThrow('Invalid message content');
    });

    test('correctly renders template with section tags', () => {
        (Mustache.render as jest.Mock).mockReturnValueOnce('Hello John!');

        const result = personalize({
            memberData: {name: 'John'},
            targetData: {},
            message: {content: 'Hello {{#user}}{{name}}{{/user}}!', targetMapping: {targetName: 'user'}},
            targetMapping: {targetName: 'user'}
        });

        expect(result).toEqual({content: 'Hello John!', targetMapping: {targetName: 'user'}});
        expect(Mustache.render).toHaveBeenCalledWith(
            'Hello {{#user}}{{name}}{{/user}}!',
            {
                targetData: {},
                user: {name: 'John'}
            }
        );
    });

    test('correctly renders template with triple-braced variables', () => {
        (Mustache.render as jest.Mock).mockReturnValueOnce('Hello John!');

        const result = personalize({
            memberData: {name: 'John'},
            targetData: {},
            message: {content: 'Hello {{{user.name}}}!', targetMapping: {targetName: 'user'}},
            targetMapping: {targetName: 'user'}
        });

        expect(result).toEqual({content: 'Hello John!', targetMapping: {targetName: 'user'}});
        expect(Mustache.render).toHaveBeenCalledWith(
            'Hello {{{user.name}}}!',
            {
                targetData: {},
                user: {name: 'John'}
            }
        );
    });

    test('throws error when message exceeds character limit', () => {
        (Mustache.render as jest.Mock).mockReturnValueOnce('x'.repeat(2001));

        expect(() => {
            personalize({
                memberData: {},
                targetData: {},
                message: {content: 'Long message', targetMapping: {targetName: 'user'}},
                targetMapping: {targetName: 'user'}
            });
        }).toThrow("Message content exceeds Discord's maximum character limit");
    });

    test('combines data correctly and renders complex template', () => {
        const template = 'Hello {{#user}}{{{name}}}{{/user}}, you are invited to {{#targetData}}{{{partyName}}}{{/targetData}}';
        (Mustache.render as jest.Mock).mockReturnValueOnce('Hello John, you are invited to Birthday Party');

        const result = personalize({
            memberData: {name: 'John'},
            targetData: {partyName: 'Birthday Party'},
            message: {content: template, targetMapping: {targetName: 'user'}},
            targetMapping: {targetName: 'user'}
        });

        expect(result).toEqual({content: 'Hello John, you are invited to Birthday Party', targetMapping:{targetName: 'user'}});
        expect(Mustache.render).toHaveBeenCalledWith(
            template,
            {
                targetData: {partyName: 'Birthday Party'},
                user: {name: 'John'}
            }
        );
    });

    test('handles Mustache rendering errors', () => {
        (Mustache.render as jest.Mock).mockImplementationOnce(() => {
            throw new Error('Mustache error');
        });

        expect(() => {
            personalize({
                memberData: {},
                targetData: {},
                message: {content: 'Invalid {{template', targetMapping: {targetName: 'user'}},
                targetMapping: {targetName: 'user'}
            });
        }).toThrow('Template rendering failed: Mustache error');
    });
});