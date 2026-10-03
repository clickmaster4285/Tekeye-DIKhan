/**
 * Microphone capture with energy-based voice activity detection.
 *
 * Only speech segments are emitted (as 16 kHz mono WAV) — silence is never uploaded.
 * Segments go to the on-prem Whisper service via Django; no audio leaves the site.
 */

export type VoiceCaptureOptions = {
  onSegment: (wav: Blob) => void
  onSpeechStart?: () => void
  /** Microphone input level 0..1, roughly every 100 ms (for a level meter). */
  onLevel?: (level: number) => void
  /** Silence (ms) that ends an utterance. */
  endSilenceMs?: number
}

const TARGET_RATE = 16000
const FRAME_MS = 20
const START_FRAMES = 4 // 80 ms above threshold starts speech
const PRE_ROLL_MS = 300
const MIN_SPEECH_MS = 350
const MAX_UTTERANCE_MS = 15000

const WORKLET = `
class TapProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) this.port.postMessage(ch.slice(0))
    return true
  }
}
registerProcessor("tekeye-tap", TapProcessor)
`

export class VoiceCapture {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private sink: GainNode | null = null
  private paused = false
  private levelPeak = 0
  private levelFrames = 0

  private frameBuf: number[] = []
  private frameSize = 0
  private preRoll: Float32Array[] = []
  private speech: Float32Array[] = []
  private inSpeech = false
  private loudFrames = 0
  private silentMs = 0
  private speechMs = 0
  private noiseFloor = 0.004

  constructor(private opts: VoiceCaptureOptions) {}

  get running(): boolean {
    return this.ctx !== null
  }

  setEndSilence(ms: number) {
    this.opts.endSilenceMs = ms
  }

  async start(): Promise<void> {
    if (this.ctx) return
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    })
    this.ctx = new AudioContext()
    // Created after an await, so the browser may start it suspended — a suspended context delivers no samples.
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {})
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }))
    try {
      await this.ctx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }
    this.frameSize = Math.round((this.ctx.sampleRate * FRAME_MS) / 1000)
    const source = this.ctx.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(this.ctx, "tekeye-tap")
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => this.onSamples(e.data)
    source.connect(this.node)
    // Some browsers only render nodes that reach the destination; route through a muted gain so nothing is heard.
    this.sink = this.ctx.createGain()
    this.sink.gain.value = 0
    this.node.connect(this.sink).connect(this.ctx.destination)
  }

  /** Re-activate the audio context (call from a user gesture if the browser suspended it). */
  async ensureRunning(): Promise<void> {
    if (this.ctx?.state === "suspended") await this.ctx.resume().catch(() => {})
  }

  stop() {
    this.node?.port.close()
    this.node?.disconnect()
    this.sink?.disconnect()
    this.sink = null
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.ctx = null
    this.stream = null
    this.node = null
    this.reset()
  }

  /** Ignore the microphone (e.g. while TTS is speaking or a request is in flight). */
  pause() {
    this.paused = true
    this.reset()
  }

  resume() {
    this.paused = false
  }

  private reset() {
    this.frameBuf = []
    this.preRoll = []
    this.speech = []
    this.inSpeech = false
    this.loudFrames = 0
    this.silentMs = 0
    this.speechMs = 0
  }

  private onSamples(samples: Float32Array) {
    if (this.paused) return
    for (let i = 0; i < samples.length; i++) {
      this.frameBuf.push(samples[i])
      if (this.frameBuf.length >= this.frameSize) {
        this.onFrame(Float32Array.from(this.frameBuf))
        this.frameBuf = []
      }
    }
  }

  private onFrame(frame: Float32Array) {
    let sum = 0
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
    const rms = Math.sqrt(sum / frame.length)
    this.levelPeak = Math.max(this.levelPeak, rms)
    if (++this.levelFrames >= 5) {
      this.opts.onLevel?.(Math.min(1, this.levelPeak * 8))
      this.levelPeak = 0
      this.levelFrames = 0
    }
    const threshold = Math.max(this.noiseFloor * 3, 0.012)
    const loud = rms > threshold

    if (!this.inSpeech) {
      // Track background noise only while nobody is talking.
      this.noiseFloor = this.noiseFloor * 0.98 + Math.min(rms, 0.05) * 0.02
      this.preRoll.push(frame)
      const maxPre = Math.ceil(PRE_ROLL_MS / FRAME_MS)
      if (this.preRoll.length > maxPre) this.preRoll.shift()
      this.loudFrames = loud ? this.loudFrames + 1 : 0
      if (this.loudFrames >= START_FRAMES) {
        this.inSpeech = true
        this.speech = [...this.preRoll]
        this.preRoll = []
        this.silentMs = 0
        this.speechMs = 0
        this.opts.onSpeechStart?.()
      }
      return
    }

    this.speech.push(frame)
    this.speechMs += FRAME_MS
    this.silentMs = loud ? 0 : this.silentMs + FRAME_MS
    const endSilence = this.opts.endSilenceMs ?? 800
    if (this.silentMs >= endSilence || this.speechMs >= MAX_UTTERANCE_MS) {
      const voicedMs = this.speechMs - this.silentMs
      const chunks = this.speech
      this.inSpeech = false
      this.speech = []
      this.loudFrames = 0
      if (voicedMs >= MIN_SPEECH_MS && this.ctx) {
        this.opts.onSegment(encodeWav(chunks, this.ctx.sampleRate))
      }
    }
  }
}

function encodeWav(chunks: Float32Array[], inputRate: number): Blob {
  const length = chunks.reduce((n, c) => n + c.length, 0)
  const input = new Float32Array(length)
  let offset = 0
  for (const c of chunks) {
    input.set(c, offset)
    offset += c.length
  }
  // Linear-interpolation resample to 16 kHz.
  const ratio = inputRate / TARGET_RATE
  const outLen = Math.floor(input.length / ratio)
  const pcm = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const i1 = Math.min(i0 + 1, input.length - 1)
    const s = input[i0] + (input[i1] - input[i0]) * (pos - i0)
    pcm[i] = Math.max(-1, Math.min(1, s)) * 0x7fff
  }
  const buffer = new ArrayBuffer(44 + pcm.length * 2)
  const view = new DataView(buffer)
  const writeStr = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i))
  }
  writeStr(0, "RIFF")
  view.setUint32(4, 36 + pcm.length * 2, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, TARGET_RATE, true)
  view.setUint32(28, TARGET_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, "data")
  view.setUint32(40, pcm.length * 2, true)
  new Int16Array(buffer, 44).set(pcm)
  return new Blob([buffer], { type: "audio/wav" })
}
