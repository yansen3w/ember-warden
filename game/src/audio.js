// Sound, synthesized live with WebAudio: no audio files, nothing to load, nothing over the
// network. The context is built on the first gesture (browsers refuse sound before one), so
// a quiet title screen warms up the moment the player presses a key. M toggles the mute.
export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  /** One short note: an oscillator that slides from `from` to `to` and fades out. */
  function blip(from, to, seconds, type, volume) {
    if (muted || !ensure()) return;
    try {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + seconds + 0.02);
    } catch {
      // Sound is garnish: a failed note never stops the game.
    }
  }

  /** A little arpeggio, one blip per step, each a touch later than the last. */
  function arpeggio(notes, step, type, volume) {
    if (muted || !ensure()) return;
    notes.forEach((frequency, index) => {
      window.setTimeout(() => blip(frequency, frequency, 0.16, type, volume), index * step * 1000);
    });
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      blip(920, 420, 0.07, 'square', 0.25);
    },
    kill() {
      blip(320, 60, 0.16, 'triangle', 0.5);
    },
    hit() {
      blip(180, 55, 0.3, 'sawtooth', 0.5);
    },
    blessing() {
      arpeggio([523, 659, 784], 0.07, 'sine', 0.4);
    },
    wave() {
      arpeggio([392, 523, 659], 0.09, 'sine', 0.4);
    },
    win() {
      arpeggio([523, 659, 784, 1047], 0.13, 'triangle', 0.45);
    },
    over() {
      arpeggio([392, 311, 233], 0.18, 'sawtooth', 0.35);
    },
  };
}
