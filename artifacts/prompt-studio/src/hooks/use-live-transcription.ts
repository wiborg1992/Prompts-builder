import { useState, useRef, useCallback, useEffect } from "react";

interface TranscriptChunk {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface UseLiveTranscriptionOptions {
  provider: "deepgram" | "openai";
  language: string;
}

interface UseLiveTranscriptionReturn {
  isConnected: boolean;
  isRecording: boolean;
  isPaused: boolean;
  finalTranscript: string;
  interimText: string;
  error: string | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<string>;
  elapsedSeconds: number;
}

export function useLiveTranscription(options: UseLiveTranscriptionOptions): UseLiveTranscriptionReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<TranscriptChunk[]>([]);
  const isPausedRef = useRef(false);
  const stopResolveRef = useRef<((transcript: string) => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setFinalTranscript("");
    setInterimText("");
    setElapsedSeconds(0);
    chunksRef.current = [];
    isPausedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      streamRef.current = stream;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws/transcribe`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify({
          type: "config",
          provider: options.provider,
          language: options.language,
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({ type: "start" }));
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "transcript") {
            if (msg.isFinal) {
              chunksRef.current.push({ text: msg.text, isFinal: true, timestamp: Date.now() });
              setFinalTranscript(prev => {
                const separator = prev ? " " : "";
                return prev + separator + msg.text;
              });
              setInterimText("");
            } else {
              setInterimText(msg.text);
            }
          } else if (msg.type === "error") {
            setError(msg.message);
          } else if (msg.type === "stopped") {
            if (stopResolveRef.current) {
              const transcript = chunksRef.current.map(c => c.text).join(" ");
              stopResolveRef.current(transcript);
              stopResolveRef.current = null;
            }
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (stopResolveRef.current) {
          const transcript = chunksRef.current.map(c => c.text).join(" ");
          stopResolveRef.current(transcript);
          stopResolveRef.current = null;
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection failed. Check your network.");
        setIsConnected(false);
      };

      if (options.provider === "deepgram") {
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState === WebSocket.OPEN && !isPausedRef.current) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            wsRef.current.send(pcm16.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      } else {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
            e.data.arrayBuffer().then(buffer => {
              wsRef.current?.send(buffer);
            });
          }
        };

        recorder.start(3000);
      }

      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

    } catch {
      setError("Microphone access denied. Please allow microphone access.");
    }
  }, [options.provider, options.language]);

  const pauseRecording = useCallback(() => {
    isPausedRef.current = true;
    setIsPaused(true);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resumeRecording = useCallback(() => {
    isPausedRef.current = false;
    setIsPaused(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop" }));
      }

      const timeout = setTimeout(() => {
        if (stopResolveRef.current) {
          const transcript = chunksRef.current.map(c => c.text).join(" ");
          stopResolveRef.current(transcript);
          stopResolveRef.current = null;
        }
      }, 10000);

      const origResolve = stopResolveRef.current;
      stopResolveRef.current = (transcript: string) => {
        clearTimeout(timeout);
        cleanup();
        setIsRecording(false);
        setIsPaused(false);
        setInterimText("");
        origResolve(transcript);
      };
    });
  }, [cleanup]);

  return {
    isConnected,
    isRecording,
    isPaused,
    finalTranscript,
    interimText,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    elapsedSeconds,
  };
}
