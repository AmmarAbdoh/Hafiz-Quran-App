let audioContext: AudioContext | null = null;

export function playWrongSound(): void {
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(180, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.24);
  } catch {
    // Audio may be blocked before a user gesture; ignore.
  }
}
