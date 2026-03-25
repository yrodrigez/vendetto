import { Player, GuildQueueEvent } from 'discord-player';
import { YoutubeiExtractor } from 'discord-player-youtubei';
import { VoiceBasedChannel } from 'discord.js';
import { getDiscordClient } from './discord-api.adapter';

interface TrackInfo {
    title: string;
    url: string;
}

interface PlayResult {
    track: TrackInfo;
    addedToQueue: boolean;
}

interface QueueResult {
    current: TrackInfo | null;
    tracks: TrackInfo[];
}

export class DiscordPlayerAdapter {
    private player!: Player;

    async initialize(): Promise<void> {
        const client = await getDiscordClient();
        this.player = new Player(client, {
            ffmpegPath: process.env.FFMPEG_PATH,
            skipFFmpeg: false,
        });
        await this.player.extractors.register(YoutubeiExtractor, {
            useYoutubeDL: true,
        });

        this.player.events.on(GuildQueueEvent.PlayerStart, (_queue, track) => {
            console.log(`[Player] Now playing: ${track.title}`);
        });
        this.player.events.on(GuildQueueEvent.AudioTrackAdd, (_queue, track) => {
            console.log(`[Player] Track added: ${track.title}`);
        });
        this.player.events.on(GuildQueueEvent.PlayerError, (_queue, error) => {
            console.error(`[Player] PlayerError:`, error.message);
        });
        this.player.events.on(GuildQueueEvent.Error, (_queue, error) => {
            console.error(`[Player] QueueError:`, error.message);
        });
        this.player.events.on(GuildQueueEvent.PlayerFinish, (_queue, track) => {
            console.log(`[Player] Finished: ${track.title}`);
        });
        this.player.events.on(GuildQueueEvent.Connection, (queue) => {
            console.log(`[Player] Connected to voice in guild ${queue.guild.id}`);
        });
    }

    async play(voiceChannel: VoiceBasedChannel, query: string): Promise<PlayResult> {
        const alreadyPlaying = this.player.nodes.get(voiceChannel.guildId) !== null;

        const result = await this.player.play(voiceChannel, query, {
            nodeOptions: {
                selfDeaf: false,
                volume: 100,
                leaveOnEmpty: true,
                leaveOnEmptyCooldown: 300_000,
                leaveOnEnd: true,
                leaveOnEndCooldown: 300_000,

            },
            audioPlayerOptions: {
                queue: true,
                transitionMode: true,
            }
        });

        return {
            track: { title: result.track.title, url: result.track.url },
            addedToQueue: alreadyPlaying,
        };
    }

    skip(guildId: string): boolean {
        const queue = this.player.nodes.get(guildId);
        if (!queue) return false;
        return queue.node.skip();
    }

    stop(guildId: string): boolean {
        const queue = this.player.nodes.get(guildId);
        if (!queue) return false;
        queue.delete();
        return true;
    }

    setVolume(guildId: string, volume: number): boolean {
        const queue = this.player.nodes.get(guildId);
        if (!queue) return false;
        queue.node.setVolume(volume);
        return true;
    }

    getVolume(guildId: string): number | null {
        const queue = this.player.nodes.get(guildId);
        if (!queue) return null;
        return queue.node.volume;
    }

    getQueue(guildId: string): QueueResult {
        const queue = this.player.nodes.get(guildId);
        if (!queue) return { current: null, tracks: [] };

        const current = queue.currentTrack
            ? { title: queue.currentTrack.title, url: queue.currentTrack.url }
            : null;

        const tracks = queue.tracks.toArray().map(t => ({
            title: t.title,
            url: t.url,
        }));

        return { current, tracks };
    }
}
