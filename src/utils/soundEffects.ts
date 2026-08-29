// Web Audio API & Haptic feedback helper for GULI Premium app settings

export function playTapSound(enabled: boolean = true) {
  if (!enabled) return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(580, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch {}
}

export function triggerHaptic(enabled: boolean = true, type: "light" | "medium" | "heavy" = "light") {
  if (!enabled) return;
  if ("vibrate" in navigator) {
    try {
      if (type === "light") navigator.vibrate(12);
      else if (type === "medium") navigator.vibrate(25);
      else if (type === "heavy") navigator.vibrate([20, 30, 20]);
    } catch {}
  }
}
