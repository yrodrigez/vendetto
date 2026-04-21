export function stereo48kToMono16k(stereo48k: Buffer): Buffer {
    const samplesPerChannel = stereo48k.length / 4
    const mono48k = Buffer.alloc(samplesPerChannel * 2)
    for (let i = 0; i < samplesPerChannel; i++) {
        const l = stereo48k.readInt16LE(i * 4)
        const r = stereo48k.readInt16LE(i * 4 + 2)
        const mixed = Math.max(-32768, Math.min(32767, (l + r) >> 1))
        mono48k.writeInt16LE(mixed, i * 2)
    }

    const outSamples = Math.floor(samplesPerChannel / 3)
    const mono16k = Buffer.alloc(outSamples * 2)
    for (let i = 0; i < outSamples; i++) {
        const s0 = mono48k.readInt16LE(i * 6)
        const s1 = mono48k.readInt16LE((i * 3 + 1) * 2)
        const s2 = mono48k.readInt16LE((i * 3 + 2) * 2)
        const avg = Math.round((s0 + s1 + s2) / 3)
        mono16k.writeInt16LE(Math.max(-32768, Math.min(32767, avg)), i * 2)
    }
    return mono16k
}
