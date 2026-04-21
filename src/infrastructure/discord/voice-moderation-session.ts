import {
    joinVoiceChannel,
    VoiceConnection,
    EndBehaviorType,
    VoiceReceiver,
    VoiceConnectionStatus,
    entersState,
} from '@discordjs/voice'
import { VoiceBasedChannel } from 'discord.js'
import { opus } from 'prism-media'
import {
    DetectionResult,
    NsfwAudioDetectorFactory,
    NsfwAudioDetectorPort,
} from '@/application/ports/outbound/audio/nsfw-audio-detector.port'
import { stereo48kToMono16k } from '@/infrastructure/audio/pcm-resampler'

const DETECTOR_CONFIG = {
    sampleRate: 16000,
    windowMs: 2000,
    hopMs: 500,
}

export interface ModerationAlert {
    userId: string
    label: string
    score: number
    windowStartMs?: number
    windowEndMs?: number
}

export type AlertHandler = (alert: ModerationAlert) => void

export interface VoiceModerationSessionOptions {
    guildId: string
    channelId: string
    adapterCreator: any
    targetLabels: string[]
    scoreThreshold: number
    detectorFactory: NsfwAudioDetectorFactory
    onAlert: AlertHandler
}

interface SpeakerContext {
    detector: NsfwAudioDetectorPort
    stop: () => void
}

export class VoiceModerationSession {
    private connection: VoiceConnection | null = null
    private readonly speakers = new Map<string, SpeakerContext>()
    private stopped = false

    constructor(private readonly opts: VoiceModerationSessionOptions) { }

    async start(): Promise<void> {
        console.log(`[VoiceMod] starting session guild=${this.opts.guildId} channel=${this.opts.channelId}`)

        this.connection = joinVoiceChannel({
            channelId: this.opts.channelId,
            guildId: this.opts.guildId,
            adapterCreator: this.opts.adapterCreator,
            selfDeaf: false,
            selfMute: true,
        })

        await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000)
        console.log(`[VoiceMod] voice connection ready guild=${this.opts.guildId}`)

        const receiver = this.connection.receiver
        receiver.speaking.on('start', (userId: string) => {
            if (this.stopped) return
            if (this.speakers.has(userId)) return
            console.log(`[VoiceMod] speaker started user=${userId}`)
            void this.attachSpeaker(receiver, userId)
        })

        this.connection.on(VoiceConnectionStatus.Disconnected, () => {
            console.log(`[VoiceMod] connection disconnected guild=${this.opts.guildId}`)
        })

        this.connection.on(VoiceConnectionStatus.Destroyed, () => {
            console.log(`[VoiceMod] connection destroyed guild=${this.opts.guildId}`)
        })
    }

    async handleUserLeave(userId: string): Promise<void> {
        const ctx = this.speakers.get(userId)
        if (!ctx) return
        console.log(`[VoiceMod] user left channel -> stopping detector user=${userId}`)
        this.speakers.delete(userId)
        ctx.stop()
        await ctx.detector.stop()
    }

    async stop(): Promise<void> {
        if (this.stopped) return
        this.stopped = true
        console.log(`[VoiceMod] stopping session guild=${this.opts.guildId}`)

        for (const [userId, ctx] of this.speakers) {
            try {
                ctx.stop()
                await ctx.detector.stop()
            } catch (err) {
                console.warn(`[VoiceMod] error stopping detector user=${userId}`, err)
            }
        }
        this.speakers.clear()

        try {
            this.connection?.destroy()
        } catch (err) {
            console.warn(`[VoiceMod] error destroying connection`, err)
        }
        this.connection = null
    }

    get guildId(): string {
        return this.opts.guildId
    }

    get channelId(): string {
        return this.opts.channelId
    }

    private async attachSpeaker(receiver: VoiceReceiver, userId: string): Promise<void> {
        const detector = this.opts.detectorFactory.create()

        const subscription = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 60_000,
            },
        })

        const decoder = new opus.Decoder({
            frameSize: 960,
            channels: 2,
            rate: 48000,
        })

        let stoppedLocal = false

        const stop = () => {
            if (stoppedLocal) return
            stoppedLocal = true
            try { subscription.destroy() } catch (_) { }
            try { decoder.destroy() } catch (_) { }
        }

        try {
            await detector.start(DETECTOR_CONFIG, (result) => this.handleDetection(userId, result))
        } catch (err) {
            console.error(`[VoiceMod] detector start failed user=${userId}`, err)
            stop()
            return
        }

        this.speakers.set(userId, { detector, stop })

        subscription.on('error', (err) => {
            console.warn(`[VoiceMod] subscription error user=${userId}`, err.message)
        })

        subscription.pipe(decoder)

        decoder.on('data', (stereo48k: Buffer) => {
            try {
                const mono16k = stereo48kToMono16k(stereo48k)
                detector.writePcm(mono16k)
            } catch (err) {
                console.warn(`[VoiceMod] pcm process error user=${userId}`, err)
            }
        })

        decoder.on('end', () => {
            console.log(`[VoiceMod] decoder end user=${userId}`)
            
        })

        subscription.on('end', () => {
            console.log(`[VoiceMod] subscription end user=${userId}`)
        })
    }

    private handleDetection(userId: string, result: DetectionResult): void {
        for (const label of result.labels) {
            const { description, score } = label
            const isTarget = this.opts.targetLabels.some(t =>
                description.toLowerCase().includes(t.toLowerCase())
            )
            if (!isTarget) continue
            if (label.score < this.opts.scoreThreshold) continue

            console.log(`[VoiceMod] ALERT user=${userId} label="${label.description}" score=${label.score.toFixed(3)}`)
            this.opts.onAlert({
                userId,
                label: label.description,
                score: label.score,
                windowStartMs: result.windowStartMs,
                windowEndMs: result.windowEndMs,
            })
        }
    }
}

export function buildSessionFromVoiceChannel(
    voiceChannel: VoiceBasedChannel,
    targetLabels: string[],
    scoreThreshold: number,
    detectorFactory: NsfwAudioDetectorFactory,
    onAlert: AlertHandler,
): VoiceModerationSession {
    console.log(targetLabels)
    return new VoiceModerationSession({
        guildId: voiceChannel.guildId,
        channelId: voiceChannel.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        targetLabels,
        scoreThreshold,
        detectorFactory,
        onAlert,
    })
}
