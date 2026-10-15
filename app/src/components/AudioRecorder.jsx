import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from 'antd';
import { Mic, Square, X, CheckCircle2, Trash2 } from 'lucide-react';

export default function AudioRecorder({ onRecordingComplete, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error('Could not access microphone. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setAudioURL(null);
    setAudioBlob(null);
    setRecordingTime(0);
    onCancel?.();
  };

  const useRecording = () => {
    if (audioBlob) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onRecordingComplete(reader.result, audioBlob);
      };
      reader.readAsDataURL(audioBlob);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-surface-2 border border-[color:var(--hair-6)]">
      {!audioURL ? (
        <>
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
              isRecording ? 'bg-bad-soft animate-pulse' : 'bg-primary-100'
            }`}
          >
            <Mic className={`w-10 h-10 ${isRecording ? 'text-bad-text' : 'text-primary-500'}`} />
          </div>
          {isRecording && (
            <div className="text-2xl font-mono font-semibold text-bad-text mb-4">
              {formatTime(recordingTime)}
            </div>
          )}
          <p className="text-sm text-gray-500 mb-4 text-center">
            {isRecording ? 'Recording... Speak your order details' : 'Click to start recording your order'}
          </p>
          <div className="flex gap-3">
            {!isRecording ? (
              <Button
                type="primary"
                size="large"
                icon={<Mic className="w-5 h-5" />}
                onClick={startRecording}
                className="bg-primary-500 border-0 rounded-full h-12 px-6"
              >
                Start Recording
              </Button>
            ) : (
              <>
                <Button
                  type="primary"
                  size="large"
                  danger
                  icon={<Square className="w-5 h-5" />}
                  onClick={stopRecording}
                  className="rounded-xl h-12 px-6"
                >
                  Stop
                </Button>
                <Button
                  size="large"
                  icon={<X className="w-5 h-5" />}
                  onClick={cancelRecording}
                  className="rounded-xl h-12 px-6"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <audio controls className="w-full mb-4" src={audioURL} />
          <p className="text-sm text-gray-500 mb-4">Duration: {formatTime(recordingTime)}</p>
          <div className="flex gap-3">
            <Button
              type="primary"
              size="large"
              icon={<CheckCircle2 className="w-5 h-5" />}
              onClick={useRecording}
              className="bg-ok border-0 rounded-full h-12 px-6"
            >
              Use This
            </Button>
            <Button
              size="large"
              icon={<Trash2 className="w-5 h-5" />}
              onClick={cancelRecording}
              className="rounded-xl h-12 px-6"
            >
              Record Again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
