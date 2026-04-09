import { useState, useRef, useCallback, useEffect } from "react";

interface DeepgramWord {
  word: string;
  speaker?: number;
  start?: number;
  end?: number;
}

interface DeepgramResult {
  type: string;
  is_final: boolean;
  speech_final: boolean;
  channel?: {
    alternatives: { transcript: string; words: DeepgramWord[] }[];
  };
}

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
}

export interface UseDeepgramSpeechProps {
  language?: string;
  speakerNames?: Record<number, string>;
}

const FILLER_PATTERNS = /\b(øh+|uhm+|hmm+|uh+|nå+h?|umm+|ahh+|huh)\b/gi;

function cleanTranscript(raw: string): string {
  return raw.replace(FILLER_PATTERNS, " ").replace(/\s{2,}/g, " ").trim();
}

function getDominantSpeaker(words: DeepgramWord[]): number {
  const counts: Record<number, number> = {};
  words.forEach((w) => {
    if (w.speaker !== undefined) counts[w.speaker] = (counts[w.speaker] || 0) + 1;
  });
  const entries = Object.entries(counts);
  if (entries.length === 0) return 0;
  return parseInt(entries.sort((a, b) => Number(b[1]) - Number(a[1]))[0][0]);
}

export function useDeepgramSpeech({
  language = "en",
  speakerNames = {},
}: UseDeepgramSpeechProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [detectedSpeakers, setDetectedSpeakers] = useState<number[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentIdCounter = useRef(0);
  const segmentsRef = useRef<TranscriptSegment[]>([]);

  const speakerNamesRef = useRef(speakerNames);
  useEffect(() => { speakerNamesRef.current = speakerNames; }, [speakerNames]);

  const pendingBufferRef = useRef<{ transcript: string; speaker: number }[]>([]);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxAgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SILENCE_MS = 14_000;
  const MAX_BUFFER_MS = 90_000;

  const getSpeakerLabel = useCallback((speakerId: number): string => {
    return speakerNamesRef.current[speakerId] ?? `Speaker ${speakerId + 1}`;
  }, []);

  const flushBuffer = useCallback(() => {
    if (commitTimerRef.current) { clearTimeout(commitTimerRef.current); commitTimerRef.current = null; }
    if (maxAgeTimerRef.current) { clearTimeout(maxAgeTimerRef.current); maxAgeTimerRef.current = null; }
    const items = [...pendingBufferRef.current];
    pendingBufferRef.current = [];
    if (items.length === 0) return;

    const groups: { transcript: string; speaker: number }[] = [];
    items.forEach((item) => {
      const last = groups[groups.length - 1];
      if (last && last.speaker === item.speaker) {
        last.transcript += " " + item.transcript;
      } else {
        groups.push({ transcript: item.transcript, speaker: item.speaker });
      }
    });

    const newSegments: TranscriptSegment[] = [];
    groups.forEach((g) => {
      const cleaned = cleanTranscript(g.transcript);
      const wordCount = cleaned.split(/\s+/).filter((w) => w.length > 1).length;
      if (wordCount >= 2) {
        const id = `seg-${++segmentIdCounter.current}`;
        const label = getSpeakerLabel(g.speaker);
        newSegments.push({ id, text: cleaned, speaker: label, timestamp: Date.now() });
      }
    });

    if (newSegments.length > 0) {
      segmentsRef.current = [...segmentsRef.current, ...newSegments];
      setSegments(segmentsRef.current);
    }
    setInterimText("");
  }, [getSpeakerLabel]);

  const stopRecording = useCallback((): TranscriptSegment[] => {
    isRecordingRef.current = false;
    if (commitTimerRef.current) { clearTimeout(commitTimerRef.current); commitTimerRef.current = null; }
    if (maxAgeTimerRef.current) { clearTimeout(maxAgeTimerRef.current); maxAgeTimerRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try { wsRef.current.close(1000, "User stopped"); } catch {}
    }
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    flushBuffer();
    setIsRecording(false);
    setInterimText("");
    return segmentsRef.current;
  }, [flushBuffer]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setSegments([]);
      segmentsRef.current = [];
      setElapsedSeconds(0);
      setDetectedSpeakers([]);
      segmentIdCounter.current = 0;

      const tokenRes = await fetch("/api/deepgram-token");
      if (!tokenRes.ok) throw new Error("Could not fetch Deepgram token from server");
      const { key } = await tokenRes.json();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 48000, min: 16000 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const lang = language.split("-")[0];
      const model = lang === "en" ? "nova-3" : "nova-2";
      const params = new URLSearchParams({
        model,
        language: lang,
        diarize: "true",
        interim_results: "true",
        smart_format: "true",
        numerals: "true",
        utterance_end_ms: "5000",
        vad_events: "true",
      });

      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
      console.info(`[deepgram] Connecting: model=${model} lang=${lang}`);
      const ws = new WebSocket(wsUrl, ["token", key]);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isRecordingRef.current) { ws.close(); return; }
        console.info("[deepgram] Connected");

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (ws.readyState === WebSocket.OPEN && e.data.size > 0) {
            ws.send(e.data);
          }
        };
        recorder.start(250);
      };

      ws.onmessage = (event) => {
        try {
          const data: DeepgramResult = JSON.parse(event.data as string);

          if (data.type === "Results") {
            const alt = data.channel?.alternatives?.[0];
            if (!alt) return;

            const transcript = alt.transcript?.trim();
            if (!transcript) return;

            const words: DeepgramWord[] = alt.words ?? [];
            const dominantSpeaker = getDominantSpeaker(words);

            setDetectedSpeakers((prev) => {
              if (prev.includes(dominantSpeaker)) return prev;
              return [...prev, dominantSpeaker].sort((a, b) => a - b);
            });

            if (data.is_final) {
              pendingBufferRef.current.push({ transcript, speaker: dominantSpeaker });

              if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
              commitTimerRef.current = setTimeout(flushBuffer, SILENCE_MS);

              if (!maxAgeTimerRef.current) {
                maxAgeTimerRef.current = setTimeout(flushBuffer, MAX_BUFFER_MS);
              }

              const speakerLabel = getSpeakerLabel(dominantSpeaker);
              const pending = pendingBufferRef.current.map((b) => b.transcript).join(" ");
              setInterimText(`[${speakerLabel}] ${pending}`);
            } else {
              const pending = pendingBufferRef.current.map((b) => b.transcript).join(" ");
              const speakerLabel = getSpeakerLabel(dominantSpeaker);
              setInterimText(`[${speakerLabel}] ${[pending, transcript].filter(Boolean).join(" ")}`);
            }
          }
        } catch {
          // ignore malformed
        }
      };

      ws.onerror = (ev) => {
        console.error("[deepgram] WebSocket onerror:", ev);
      };

      ws.onclose = (ev) => {
        console.warn("[deepgram] WebSocket closed — code:", ev.code, "reason:", ev.reason);
        if (ev.code === 1000) return;
        let msg = `Deepgram disconnected (code ${ev.code})`;
        if (ev.code === 1008 || ev.reason?.toLowerCase().includes("auth") || ev.reason?.toLowerCase().includes("invalid")) {
          msg = "Deepgram: invalid API key. Update the key and restart.";
        } else if (ev.code === 1006) {
          msg = "Deepgram: network error — could not connect.";
        } else if (ev.reason) {
          msg = `Deepgram: ${ev.reason} (code ${ev.code})`;
        }
        if (isRecordingRef.current) {
          setError(msg);
          stopRecording();
        }
      };

      isRecordingRef.current = true;
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("[deepgram] Start error:", err);
      setError(err?.message ?? "Could not start recording");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsRecording(false);
    }
  }, [language, flushBuffer, stopRecording, getSpeakerLabel]);

  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
        if (maxAgeTimerRef.current) clearTimeout(maxAgeTimerRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          try { mediaRecorderRef.current.stop(); } catch {}
        }
        if (wsRef.current) {
          try { wsRef.current.close(); } catch {}
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    isRecording,
    interimText,
    error,
    segments,
    detectedSpeakers,
    elapsedSeconds,
    startRecording,
    stopRecording,
  };
}
