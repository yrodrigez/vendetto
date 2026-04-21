import WebSocket from 'ws'
import {
    DetectionHandler,
    DetectorConfig,
    LabelAnnotation,
    NsfwAudioDetectorFactory,
    NsfwAudioDetectorPort,
} from '@/application/ports/outbound/audio/nsfw-audio-detector.port'

interface ServerResponseFrame {
    responses?: Array<{
        labelAnnotations?: Array<{
            mid: string
            description: string
            score: number
            topicality?: number
        }>
        windowStartMs?: number
        windowEndMs?: number
    }>
    ready?: boolean
    isFinal?: boolean
    error?: string
}

export class NsfwSoundDetectClient implements NsfwAudioDetectorPort {
    private ws: WebSocket | null = null
    private ready = false
    private pendingChunks: Buffer[] = []
    private onDetection: DetectionHandler | null = null
    private readonly label: string

    constructor(
        private readonly wsUrl: string,
        label: string,
    ) {
        this.label = label
    }

    async start(config: DetectorConfig, onDetection: DetectionHandler): Promise<void> {
        this.onDetection = onDetection
        this.ws = new WebSocket(this.wsUrl)

        await new Promise<void>((resolve, reject) => {
            if (!this.ws) return reject(new Error('ws not created'))

            const onOpen = () => {
                console.log(`[NsfwDetect:${this.label}] ws open -> sending config`, config)
                this.ws?.send(JSON.stringify(config))
            }

            const onMessage = (data: WebSocket.RawData) => {
                const text = data.toString()
                let msg: ServerResponseFrame
                try {
                    msg = JSON.parse(text)
                } catch (err) {
                    console.warn(`[NsfwDetect:${this.label}] non-JSON message`, text)
                    return
                }

                if (msg.ready === true) {
                    console.log(`[NsfwDetect:${this.label}] server ready`)
                    this.ready = true
                    this.flushPending()
                    resolve()
                    return
                }

                if (msg.error) {
                    console.error(`[NsfwDetect:${this.label}] server error`, msg.error)
                    return
                }

                this.handleFrame(msg)
            }

            const onError = (err: Error) => {
                console.error(`[NsfwDetect:${this.label}] ws error`, err.message)
                reject(err)
            }

            const onClose = (code: number, reason: Buffer) => {
                console.log(`[NsfwDetect:${this.label}] ws closed code=${code} reason=${reason.toString()}`)
                this.ready = false
            }

            this.ws.once('open', onOpen)
            this.ws.on('message', onMessage)
            this.ws.once('error', onError)
            this.ws.once('close', onClose)
        })
    }

    writePcm(chunk: Buffer): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
        if (!this.ready) {
            this.pendingChunks.push(chunk)
            return
        }
        this.ws.send(chunk, { binary: true })
    }

    async stop(): Promise<void> {
        if (!this.ws) return
        try {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'end' }))
            }
        } catch (err) {
            console.warn(`[NsfwDetect:${this.label}] failed to send end`, err)
        }
        await new Promise<void>((resolve) => {
            if (!this.ws) return resolve()
            if (this.ws.readyState === WebSocket.CLOSED) return resolve()
            this.ws.once('close', () => resolve())
            setTimeout(() => resolve(), 2000)
            try {
                this.ws.close()
            } catch (_) { }
        })
        this.ws = null
        this.ready = false
        this.pendingChunks = []
    }

    private flushPending(): void {
        if (!this.ws) return
        for (const chunk of this.pendingChunks) {
            this.ws.send(chunk, { binary: true })
        }
        this.pendingChunks = []
    }

    private handleFrame(msg: ServerResponseFrame): void {
        if (!msg.responses) return
        for (const resp of msg.responses) {
            const labels: LabelAnnotation[] = (resp.labelAnnotations ?? []).map(l => ({
                mid: l.mid,
                description: l.description,
                score: l.score,
            }))
            if (labels.length === 0) continue
            this.onDetection?.({
                labels,
                windowStartMs: resp.windowStartMs,
                windowEndMs: resp.windowEndMs,
            })
        }
    }
}

export class NsfwSoundDetectClientFactory implements NsfwAudioDetectorFactory {
    constructor(private readonly wsUrl: string) { }

    create(): NsfwAudioDetectorPort {
        const label = Math.random().toString(36).slice(2, 8)
        return new NsfwSoundDetectClient(this.wsUrl, label)
    }
}
