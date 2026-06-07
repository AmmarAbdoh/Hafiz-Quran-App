import {
  PRACTICE_MAX_PHRASE_MS,
  PRACTICE_MIN_ROLLING_MS,
  PRACTICE_MIN_SPEECH_MS,
  PRACTICE_ROLLING_CHUNK_MS,
  PRACTICE_ROLLING_WINDOW_MS,
  PRACTICE_SAMPLE_RATE,
  PRACTICE_SILENCE_MS,
  PRACTICE_SPEECH_RMS_THRESHOLD,
} from "@/shared/constants/recitation-practice";

export interface MicCaptureHandle {
  stop: () => void;
}

export interface PhraseMicCallbacks {
  onPhrase: (samples: Float32Array) => void;
  onRollingChunk?: (samples: Float32Array) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onLevelChange?: (level: number) => void;
}

const MIC_LEVEL_REFERENCE_RMS = PRACTICE_SPEECH_RMS_THRESHOLD * 4;

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

function trimToWindow(samples: number[], maxSamples: number): number[] {
  if (samples.length <= maxSamples) return samples;
  return samples.slice(samples.length - maxSamples);
}

/** Rolling STT while speaking; final buffer after a short pause. */
export function startPhraseMicCapture(
  callbacks: PhraseMicCallbacks,
): Promise<MicCaptureHandle> {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      const minPhraseSamples = Math.floor(
        (PRACTICE_MIN_SPEECH_MS / 1000) * PRACTICE_SAMPLE_RATE,
      );
      const maxPhraseSamples = Math.floor(
        (PRACTICE_MAX_PHRASE_MS / 1000) * PRACTICE_SAMPLE_RATE,
      );
      const silenceSamplesNeeded = Math.floor(
        (PRACTICE_SILENCE_MS / 1000) * PRACTICE_SAMPLE_RATE,
      );
      const rollingWindowSamples = Math.floor(
        (PRACTICE_ROLLING_WINDOW_MS / 1000) * PRACTICE_SAMPLE_RATE,
      );
      const minRollingSamples = Math.floor(
        (PRACTICE_MIN_ROLLING_MS / 1000) * PRACTICE_SAMPLE_RATE,
      );
      const rollingChunkSamples = Math.floor(
        (PRACTICE_ROLLING_CHUNK_MS / 1000) * PRACTICE_SAMPLE_RATE,
      );

      const phraseBuffer: number[] = [];
      const rollingBuffer: number[] = [];
      let speaking = false;
      let silenceSamples = 0;
      let samplesSinceRollingEmit = 0;
      let lastSpeaking = false;

      const notifySpeaking = (next: boolean) => {
        if (next !== lastSpeaking) {
          lastSpeaking = next;
          callbacks.onSpeakingChange?.(next);
        }
      };

      const emitRollingChunk = () => {
        if (!callbacks.onRollingChunk) return;
        if (rollingBuffer.length < minRollingSamples) return;
        callbacks.onRollingChunk(new Float32Array(rollingBuffer));
        samplesSinceRollingEmit = 0;
      };

      const flushPhrase = () => {
        if (phraseBuffer.length < minPhraseSamples) {
          phraseBuffer.length = 0;
          rollingBuffer.length = 0;
          speaking = false;
          silenceSamples = 0;
          samplesSinceRollingEmit = 0;
          notifySpeaking(false);
          return;
        }

        callbacks.onPhrase(new Float32Array(phraseBuffer));
        phraseBuffer.length = 0;
        rollingBuffer.length = 0;
        speaking = false;
        silenceSamples = 0;
        samplesSinceRollingEmit = 0;
        notifySpeaking(false);
      };

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const ratio = audioContext.sampleRate / PRACTICE_SAMPLE_RATE;
        const block: number[] = [];

        for (let index = 0; index < input.length; index += ratio) {
          const sampleIndex = Math.floor(index);
          if (sampleIndex < input.length) {
            block.push(input[sampleIndex]!);
          }
        }

        const blockRms = computeRms(new Float32Array(block));
        callbacks.onLevelChange?.(
          Math.min(1, blockRms / MIC_LEVEL_REFERENCE_RMS),
        );
        const isSpeech = blockRms >= PRACTICE_SPEECH_RMS_THRESHOLD;

        if (isSpeech) {
          speaking = true;
          silenceSamples = 0;
          notifySpeaking(true);
          phraseBuffer.push(...block);
          rollingBuffer.push(...block);
          const trimmed = trimToWindow(rollingBuffer, rollingWindowSamples);
          rollingBuffer.length = 0;
          rollingBuffer.push(...trimmed);
          samplesSinceRollingEmit += block.length;

          if (samplesSinceRollingEmit >= rollingChunkSamples) {
            emitRollingChunk();
          }
        } else if (speaking) {
          phraseBuffer.push(...block);
          rollingBuffer.push(...block);
          const trimmed = trimToWindow(rollingBuffer, rollingWindowSamples);
          rollingBuffer.length = 0;
          rollingBuffer.push(...trimmed);
          silenceSamples += block.length;

          if (silenceSamples >= silenceSamplesNeeded) {
            emitRollingChunk();
            flushPhrase();
            return;
          }
        }

        if (speaking && phraseBuffer.length >= maxPhraseSamples) {
          emitRollingChunk();
          flushPhrase();
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      resolve({
        stop: () => {
          callbacks.onLevelChange?.(0);
          processor.disconnect();
          source.disconnect();
          stream.getTracks().forEach((track) => track.stop());
          void audioContext.close();
        },
      });
    } catch (error) {
      reject(error);
    }
  });
}
