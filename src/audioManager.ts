// Web Audio API procedural ambient soundscapes and navigation SFX
// Zero 404 dependencies - 100% synthesized in real time

class SoundManager {
  private ctx: AudioContext | null = null;
  private isAmbientPlaying: boolean = false;
  private ambientGain: GainNode | null = null;
  private noiseNode: AudioNode | null = null;
  private padGain: GainNode | null = null;
  private isMuted: boolean = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play subtle spatial ambient atmosphere (gentle warm tone & light breeze)
  startAmbient() {
    if (this.isAmbientPlaying || this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.08, now + 2);
      masterGain.connect(this.ctx.destination);
      this.ambientGain = masterGain;

      // 1. Procedural pink noise breeze generator
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Lowpass filter for smooth airy wind sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);

      // Low frequency oscillator (LFO) to modulate breeze gently
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.15, now);
      lfoGain.gain.setValueAtTime(140, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();
      lfo.start();
      this.noiseNode = whiteNoise;

      // 2. Harmonic warm ambient pad chord (Cmaj9 frequencies: 130.81, 164.81, 196.00, 246.94)
      const freqs = [130.81, 196.00, 246.94, 293.66];
      const padMaster = this.ctx.createGain();
      padMaster.gain.setValueAtTime(0.025, now);
      padMaster.connect(masterGain);
      this.padGain = padMaster;

      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.015 / (idx + 1), now);

        if (panner) {
          panner.pan.setValueAtTime((idx % 2 === 0 ? -0.4 : 0.4), now);
          osc.connect(oscGain);
          oscGain.connect(panner);
          panner.connect(padMaster);
        } else {
          osc.connect(oscGain);
          oscGain.connect(padMaster);
        }
        osc.start();
      });

      this.isAmbientPlaying = true;
    } catch {
      // Audio autoplay policy handled smoothly
    }
  }

  stopAmbient() {
    if (!this.isAmbientPlaying || !this.ambientGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + 1);
      setTimeout(() => {
        this.isAmbientPlaying = false;
      }, 1000);
    } catch {
      this.isAmbientPlaying = false;
    }
  }

  toggleAmbient(enable?: boolean): boolean {
    const targetState = enable !== undefined ? enable : !this.isAmbientPlaying;
    if (targetState) {
      this.isMuted = false;
      this.startAmbient();
      return true;
    } else {
      this.stopAmbient();
      return false;
    }
  }

  // Play Street View transition whoosh + soft chime
  playTransitionSfx() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Whoosh sweep
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.35);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.7);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 0.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.75);

      // Soft crystal chime on arrival
      const chime = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(880, now + 0.35); // A5
      chime.frequency.exponentialRampToValueAtTime(1046.5, now + 0.45); // C6

      chimeGain.gain.setValueAtTime(0.0001, now);
      chimeGain.gain.setValueAtTime(0.06, now + 0.35);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      chime.connect(chimeGain);
      chimeGain.connect(this.ctx.destination);
      chime.start(now + 0.35);
      chime.stop(now + 0.95);
    } catch {
      // Audio gracefully skipped if blocked
    }
  }

  // Play click / hover tactile feedback
  playClickSfx() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignore
    }
  }

  isPlaying(): boolean {
    return this.isAmbientPlaying;
  }
}

export const soundManager = new SoundManager();
