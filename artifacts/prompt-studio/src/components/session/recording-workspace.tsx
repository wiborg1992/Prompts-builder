import { useState, useEffect, useRef } from "react";
import { useLiveTranscription } from "@/hooks/use-live-transcription";
import {
  useAddContextItem,
  getListContextItemsQueryKey,
  getGetSessionSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Square,
  Languages,
  Radio,
  Loader2,
  Save,
} from "lucide-react";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

type RecordingState = "idle" | "recording" | "paused" | "stopped";

export function RecordingWorkspace({ sessionId }: { sessionId: number }) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<"deepgram" | "openai">("deepgram");
  const [language, setLanguage] = useState("en");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [savedTranscript, setSavedTranscript] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const {
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
  } = useLiveTranscription({ provider, language });

  const addItem = useAddContextItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContextItemsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setSavedTranscript(null);
      },
    },
  });

  useEffect(() => {
    if (isRecording && !isPaused) {
      setRecordingState("recording");
    } else if (isPaused) {
      setRecordingState("paused");
    } else if (!isRecording && recordingState !== "idle" && recordingState !== "stopped") {
      setRecordingState("stopped");
    }
  }, [isRecording, isPaused]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalTranscript, interimText]);

  const handleStart = async () => {
    setSavedTranscript(null);
    await startRecording();
  };

  const handlePause = () => {
    pauseRecording();
  };

  const handleResume = () => {
    resumeRecording();
  };

  const handleStop = async () => {
    const transcript = await stopRecording();
    setRecordingState("stopped");
    if (transcript.trim()) {
      setSavedTranscript(transcript.trim());
    }
  };

  const handleSaveTranscript = () => {
    const text = savedTranscript || finalTranscript;
    if (!text.trim()) return;
    addItem.mutate({
      sessionId,
      data: {
        type: "transcript",
        label: `Recording — ${provider === "deepgram" ? "Deepgram" : "OpenAI"} (${language === "da" ? "Danish" : "English"})`,
        content: text.trim(),
      },
    });
    setRecordingState("idle");
    setSavedTranscript(null);
  };

  const handleNewRecording = () => {
    setRecordingState("idle");
    setSavedTranscript(null);
  };

  const displayTranscript = savedTranscript || finalTranscript;
  const isIdle = recordingState === "idle";
  const isStopped = recordingState === "stopped";

  return (
    <div className="flex flex-col h-full" data-testid="recording-workspace">
      <div className="flex-none p-4 border-b border-border bg-card/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isRecording && !isPaused ? "bg-red-500 animate-pulse" : isPaused ? "bg-amber-500" : isStopped ? "bg-blue-500" : "bg-zinc-600"}`} />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {isRecording && !isPaused ? "Recording" : isPaused ? "Paused" : isStopped ? "Recording Complete" : "Ready"}
            </span>
            {(isRecording || isPaused) && (
              <span className="text-sm font-mono text-foreground">{formatTime(elapsedSeconds)}</span>
            )}
          </div>

          {(isIdle || isStopped) && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-muted-foreground" />
                <Select value={language} onValueChange={setLanguage} disabled={isRecording}>
                  <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="da">Danish</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-muted-foreground" />
                <Select value={provider} onValueChange={(v) => setProvider(v as "deepgram" | "openai")} disabled={isRecording}>
                  <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deepgram">Deepgram</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4">
          {isIdle && (
            <Button
              size="lg"
              className="h-14 px-8 text-base rounded-full bg-red-600 hover:bg-red-700 text-white"
              onClick={handleStart}
              data-testid="button-start-recording"
            >
              <Mic className="w-5 h-5 mr-2" />
              Start Recording
            </Button>
          )}

          {isRecording && !isPaused && (
            <>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-6 rounded-full"
                onClick={handlePause}
                data-testid="button-pause"
              >
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-12 px-6 rounded-full"
                onClick={handleStop}
                data-testid="button-stop"
              >
                <Square className="w-5 h-5 mr-2" />
                Stop
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button
                size="lg"
                className="h-12 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleResume}
                data-testid="button-resume"
              >
                <Play className="w-5 h-5 mr-2" />
                Resume
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="h-12 px-6 rounded-full"
                onClick={handleStop}
                data-testid="button-stop-paused"
              >
                <Square className="w-5 h-5 mr-2" />
                Stop
              </Button>
            </>
          )}

          {isStopped && displayTranscript && (
            <>
              <Button
                size="lg"
                className="h-12 px-6 rounded-full"
                onClick={handleSaveTranscript}
                disabled={addItem.isPending}
                data-testid="button-save-transcript"
              >
                {addItem.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                Save to Context
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-6 rounded-full"
                onClick={handleNewRecording}
                data-testid="button-new-recording"
              >
                <Mic className="w-5 h-5 mr-2" />
                New Recording
              </Button>
            </>
          )}

          {isStopped && !displayTranscript && (
            <Button
              size="lg"
              className="h-14 px-8 text-base rounded-full bg-red-600 hover:bg-red-700 text-white"
              onClick={handleStart}
              data-testid="button-restart-recording"
            >
              <Mic className="w-5 h-5 mr-2" />
              Start Recording
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex-none px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <span className="text-xs text-destructive">{error}</span>
        </div>
      )}

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          {!displayTranscript && !interimText && isIdle && (
            <div className="text-center py-20">
              <MicOff className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
              <p className="text-lg text-muted-foreground">Ready to record</p>
              <p className="text-sm text-muted-foreground/70 mt-2 max-w-md mx-auto">
                Select your language and transcription provider, then press Start Recording.
                The transcript will appear here in real time as you speak.
              </p>
            </div>
          )}

          {!displayTranscript && !interimText && isRecording && (
            <div className="text-center py-20">
              <div className="flex items-center justify-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{
                      height: `${20 + Math.random() * 30}px`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-lg text-muted-foreground">Listening...</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Speak into your microphone. The transcript will appear here.
              </p>
            </div>
          )}

          {(displayTranscript || interimText) && (
            <Card className="border-border/50 bg-card/30">
              <CardContent className="p-6">
                <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                  {displayTranscript}
                  {interimText && (
                    <span className="text-muted-foreground/60 italic"> {interimText}</span>
                  )}
                </p>
                <div ref={transcriptEndRef} />
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
