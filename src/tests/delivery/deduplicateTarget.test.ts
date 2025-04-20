import {describe, expect, test} from '@jest/globals';
import {deduplicateTarget} from '../../delivery/deduplicateTarget.js';

describe('deduplicateTarget', () => {
    test('returns empty array for empty input', () => {
        expect(deduplicateTarget([])).toEqual([]);
    });

    test('returns empty array for null or undefined input', () => {
        expect(deduplicateTarget(null as any)).toEqual([]);
        expect(deduplicateTarget(undefined as any)).toEqual([]);
    });

    test('returns empty array for non-array input', () => {
        expect(deduplicateTarget({} as any)).toEqual([]);
        expect(deduplicateTarget("string" as any)).toEqual([]);
    });

    test('returns array with valid Discord IDs', () => {
        const input = [
            {discordId: '123456789'},
            {discordId: '987654321'}
        ];
        expect(deduplicateTarget(input)).toEqual(input);
    });

    test('deduplicates array based on Discord IDs', () => {
        const input = [
            {discordId: '123456789'},
            {discordId: '123456789'},
            {discordId: '987654321'}
        ];
        const expected = [
            {discordId: '123456789'},
            {discordId: '987654321'}
        ];
        expect(deduplicateTarget(input)).toEqual(expected);
    });

    test('filters out invalid Discord IDs', () => {
        const input = [
            {discordId: '123456789'},
            {discordId: 'abc123'},
            {discordId: ''},
            {discordId: '987654321'},
            {notDiscordId: '123456'} as any,
            {} as any
        ];
        const expected = [
            {discordId: '123456789'},
            {discordId: '987654321'}
        ];
        expect(deduplicateTarget(input)).toEqual(expected);
    });

    test('handles mixed valid, invalid, and duplicate entries', () => {
        const input = [
            {discordId: '123456789'},
            {discordId: 'abc123'},
            {discordId: '123456789'},
            {discordId: '987654321'},
            {discordId: ''},
            {discordId: '123456789'},
            {notDiscordId: '123456'} as any
        ];
        const expected = [
            {discordId: '123456789'},
            {discordId: '987654321'}
        ];
        expect(deduplicateTarget(input)).toEqual(expected);
    });
});