let ctx: AudioContext | null = null

/** 两音合成提示音：短促、轻柔，不刺耳 */
export function playChime(volume: number): void {
  if (volume <= 0) return
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()

  const now = ctx.currentTime
  const notes = [880, 1174.66] // A5 → D6
  for (let i = 0; i < notes.length; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = notes[i]
    const start = now + i * 0.28
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume * 0.35, start + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 1)
  }
}
