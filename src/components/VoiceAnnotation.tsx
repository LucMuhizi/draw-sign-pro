import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startRecording, stopRecording, isRecordingSupported, formatDuration } from "@/lib/voiceAnnotation";
import { motion, AnimatePresence } from "framer-motion";
import { hapticLight, hapticMedium } from "@/lib/haptics";

interface VoiceAnnotationProps {
  signatureId: string;
  onAttach: (signatureId: string, blobUrl: string, duration: number) => void;
  onDetach: (signatureId: string) => void;
  attachedVoice?: { blobUrl: string; duration: number } | null;
}

export const VoiceAnnotation = ({ signatureId, onAttach, onDetach, attachedVoice }: VoiceAnnotationProps) => {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useState(() => {
    isRecordingSupported().then(setSupported);
  });

  const handleToggleRecord = useCallback(async () => {
    if (recording) {
      try {
        const { blob, duration } = await stopRecording();
        const blobUrl = URL.createObjectURL(blob);
        hapticMedium();
        onAttach(signatureId, blobUrl, duration);
      } catch {
        // Recording cancelled
      }
      setRecording(false);
    } else {
      try {
        hapticLight();
        await startRecording();
        setRecording(true);
      } catch {
        // Permission denied
      }
    }
  }, [recording, signatureId, onAttach]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current || !attachedVoice) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.src = attachedVoice.blobUrl;
      audioRef.current.play();
      setPlaying(true);
      audioRef.current.onended = () => setPlaying(false);
    }
  }, [playing, attachedVoice]);

  const handleRemove = useCallback(() => {
    if (attachedVoice) URL.revokeObjectURL(attachedVoice.blobUrl);
    onDetach(signatureId);
    hapticLight();
  }, [attachedVoice, signatureId, onDetach]);

  if (supported === false) return null;

  return (
    <div className="flex items-center gap-1">
      {attachedVoice ? (
        <div className="flex items-center gap-1 bg-primary/10 rounded-lg px-2 py-1">
          <button
            onClick={handlePlayPause}
            className="w-6 h-6 flex items-center justify-center text-primary hover:bg-primary/20 rounded transition-colors"
          >
            {playing ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <span className="text-[10px] text-muted-foreground font-mono min-w-[24px]">
            {formatDuration(attachedVoice.duration)}
          </span>
          <button
            onClick={handleRemove}
            className="w-5 h-5 flex items-center justify-center text-destructive hover:bg-destructive/20 rounded transition-colors"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
          <audio ref={audioRef} className="hidden" />
        </div>
      ) : (
        <AnimatePresence>
          {recording ? (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={handleToggleRecord}
              className="w-7 h-7 flex items-center justify-center bg-destructive text-destructive-foreground rounded-full animate-pulse"
            >
              <MicOff className="w-3.5 h-3.5" />
            </motion.button>
          ) : (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={handleToggleRecord}
              className="w-7 h-7 flex items-center justify-center bg-muted hover:bg-primary/20 text-muted-foreground hover:text-primary rounded-full transition-all"
            >
              <Mic className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};
