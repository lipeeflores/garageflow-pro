import { useCallback, useRef } from "react";

type AlertSound = "new_os" | "approved" | "ready" | "warning" | "notification";

// Web Audio API based sound generator for reliable audio in browsers
export function useSoundAlerts() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.3
  ) => {
    try {
      const ctx = getAudioContext();
      
      // Resume audio context if suspended (browser autoplay policy)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      // Fade in/out to avoid clicks
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, now + duration - 0.05);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  }, [getAudioContext]);

  const playSequence = useCallback((
    notes: Array<{ freq: number; dur: number; delay: number }>,
    type: OscillatorType = "sine",
    volume: number = 0.3
  ) => {
    notes.forEach(({ freq, dur, delay }) => {
      setTimeout(() => playTone(freq, dur, type, volume), delay * 1000);
    });
  }, [playTone]);

  const playSound = useCallback((sound: AlertSound) => {
    switch (sound) {
      case "new_os":
        // Upbeat double chime - new work order
        playSequence([
          { freq: 523, dur: 0.15, delay: 0 },      // C5
          { freq: 659, dur: 0.15, delay: 0.12 },   // E5
          { freq: 784, dur: 0.25, delay: 0.24 },   // G5
        ], "sine", 0.35);
        break;

      case "approved":
        // Success fanfare - budget approved
        playSequence([
          { freq: 392, dur: 0.12, delay: 0 },      // G4
          { freq: 523, dur: 0.12, delay: 0.1 },    // C5
          { freq: 659, dur: 0.12, delay: 0.2 },    // E5
          { freq: 784, dur: 0.3, delay: 0.3 },     // G5
        ], "sine", 0.4);
        break;

      case "ready":
        // Completion sound - ready for pickup
        playSequence([
          { freq: 880, dur: 0.1, delay: 0 },       // A5
          { freq: 988, dur: 0.1, delay: 0.08 },    // B5
          { freq: 1047, dur: 0.25, delay: 0.16 },  // C6
        ], "triangle", 0.35);
        break;

      case "warning":
        // Alert sound - attention needed
        playSequence([
          { freq: 440, dur: 0.15, delay: 0 },      // A4
          { freq: 440, dur: 0.15, delay: 0.2 },    // A4
          { freq: 440, dur: 0.15, delay: 0.4 },    // A4
        ], "square", 0.25);
        break;

      case "notification":
        // Gentle notification
        playTone(880, 0.2, "sine", 0.25);
        break;

      default:
        playTone(660, 0.15, "sine", 0.25);
    }
  }, [playSequence, playTone]);

  // Test all sounds
  const testSounds = useCallback(() => {
    const sounds: AlertSound[] = ["new_os", "approved", "ready", "warning", "notification"];
    sounds.forEach((sound, index) => {
      setTimeout(() => {
        console.log(`Playing: ${sound}`);
        playSound(sound);
      }, index * 1500);
    });
  }, [playSound]);

  return { playSound, testSounds };
}
