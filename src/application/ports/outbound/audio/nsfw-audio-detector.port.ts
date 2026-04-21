export interface LabelAnnotation {
    mid: string
    description: string
    score: number
}

export interface DetectionResult {
    labels: LabelAnnotation[]
    windowStartMs?: number
    windowEndMs?: number
}

export interface DetectorConfig {
    sampleRate: number
    windowMs: number
    hopMs: number
}

export type DetectionHandler = (result: DetectionResult) => void

export interface NsfwAudioDetectorPort {
    start(config: DetectorConfig, onDetection: DetectionHandler): Promise<void>
    writePcm(chunk: Buffer): void
    stop(): Promise<void>
}

export interface NsfwAudioDetectorFactory {
    create(): NsfwAudioDetectorPort
}
