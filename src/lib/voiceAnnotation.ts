export interface VoiceNote {
  id: string;
  signatureId: string;
  blobUrl: string;
  duration: number;
  createdAt: number;
}

const STORAGE_KEY = 'draw-sign-pro-voice-notes';

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingStartTime = 0;

export function getVoiceNotes(): VoiceNote[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function persistVoiceNotes(notes: VoiceNote[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.map(n => ({ ...n, blobUrl: '' }))));
}

export async function startRecording(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Recording not supported');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

  mediaRecorder = new MediaRecorder(stream, { mimeType });
  audioChunks = [];
  recordingStartTime = Date.now();

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.start();
}

export function stopRecording(): Promise<{ blob: Blob; duration: number }> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) {
      reject(new Error('No active recording'));
      return;
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
      const duration = Math.round((Date.now() - recordingStartTime) / 1000);
      mediaRecorder?.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      resolve({ blob, duration });
    };

    mediaRecorder.stop();
  });
}

export async function isRecordingSupported(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch {
    return false;
  }
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
