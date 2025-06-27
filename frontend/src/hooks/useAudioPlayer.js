import { useRef, useCallback } from 'react';

export const useAudioPlayer = () => {
  const currentAudioRef = useRef(null);

  // Convert Base64 to ArrayBuffer
  const base64ToArrayBuffer = useCallback((base64) => {
    const binaryString = atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, []);

  // Create WAV header for PCM data
  const createWAVHeader = useCallback((sampleRate, numChannels, bitsPerSample, dataLength) => {
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    function writeString(view, offset, text) {
      for (let i = 0; i < text.length; i++) {
        view.setUint8(offset + i, text.charCodeAt(i));
      }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    return buffer;
  }, []);

  // Create WAV blob from PCM data
  const createWAVBlob = useCallback((pcmData, sampleRate, numChannels, bitsPerSample) => {
    const wavHeader = createWAVHeader(
      sampleRate,
      numChannels,
      bitsPerSample,
      pcmData.byteLength
    );

    const wavBuffer = new Uint8Array(wavHeader.byteLength + pcmData.byteLength);
    wavBuffer.set(new Uint8Array(wavHeader), 0);
    wavBuffer.set(new Uint8Array(pcmData), wavHeader.byteLength);

    return new Blob([wavBuffer], { type: 'audio/wav' });
  }, [createWAVHeader]);

  // Play PCM audio data
  const playPCMAudio = useCallback(async (base64PCMData) => {
    try {
      // Stop any currently playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // Convert base64 PCM to ArrayBuffer
      const pcmData = base64ToArrayBuffer(base64PCMData);
      
      // Create WAV blob (24kHz, mono, 16-bit as per GenAI specs)
      const wavBlob = createWAVBlob(pcmData, 24000, 1, 16);
      
      // Create audio URL and play
      const audioURL = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioURL);
      
      currentAudioRef.current = audio;
      
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioURL);
          currentAudioRef.current = null;
          console.log('🎵 PCM audio playback completed');
          resolve();
        };
        
        audio.onerror = (error) => {
          URL.revokeObjectURL(audioURL);
          currentAudioRef.current = null;
          console.error('🎵 PCM audio error:', error);
          reject(new Error('Audio playback failed'));
        };
        
        audio.onloadstart = () => {
          console.log('🎵 PCM audio ready, starting playback');
        };
        
        audio.onplay = () => {
          console.log('🎵 PCM audio started playing');
        };
        
        audio.play().catch(reject);
      });
    } catch (error) {
      console.error('Error playing PCM audio:', error);
      throw error;
    }
  }, [base64ToArrayBuffer, createWAVBlob]);

  // Stop current audio playback
  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      console.log('🎵 Audio playback stopped');
    }
  }, []);

  return {
    playPCMAudio,
    stopAudio,
    isInitialized: true // Always ready with this approach
  };
};