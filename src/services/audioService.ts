// Web Audio API sound synthesizer for emergency alerts, sirens, and haptics

class EmergencyAudioService {
  private ctx: AudioContext | null = null;
  private sirenIntervalId: number | null = null;
  private isMuted: boolean = false;

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stopSiren();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }


  // Short, attention-grabbing impact alert. Called as soon as the detector crosses
  // the impact threshold; the repeating siren starts later if confirmation succeeds.
  public playImpactAlert(): void {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [880, 660, 880].forEach((frequency, index) => {
        const start = now + index * 0.16;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(start);
        osc.stop(start + 0.14);
      });
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([180, 70, 180]);
      }
    } catch {
      // Mobile browsers may block audio until the user has interacted with the page.
    }
  }

  // Plays a single alert beep (used on countdown ticks)
  public playCountdownBeep(highPitch: boolean = false): void {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(highPitch ? 1100 : 880, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);

      // Trigger navigator vibration if supported
      if ('vibrate' in navigator) {
        navigator.vibrate(highPitch ? [150, 50, 150] : [100]);
      }
    } catch {
      // Audio context might fail in autoplay restricted states until user gesture
    }
  }

  // Starts continuous pulsing high-low emergency siren during countdown
  public startSiren(): void {
    if (this.isMuted || this.sirenIntervalId !== null) return;
    this.initContext();

    let toggle = false;
    this.playSirenTone(toggle);

    this.sirenIntervalId = window.setInterval(() => {
      toggle = !toggle;
      this.playSirenTone(toggle);
    }, 450);
  }

  private playSirenTone(high: boolean) {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(high ? 980 : 650, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.42);

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100]);
      }
    } catch {
      // audio error handling
    }
  }

  public stopSiren(): void {
    if (this.sirenIntervalId !== null) {
      clearInterval(this.sirenIntervalId);
      this.sirenIntervalId = null;
    }
  }

  // Positive chime for "I'm OK - Cancel"
  public playCancelChime(): void {
    this.stopSiren();
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, this.ctx.currentTime + 0.2); // G5

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.45);
    } catch {
      // silence
    }
  }
  /**
   * Releases the AudioContext to free native audio thread resources.
   * Should be called on app shutdown or when audio is no longer needed.
   */
  public dispose(): void {
    this.stopSiren();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const emergencyAudio = new EmergencyAudioService();
