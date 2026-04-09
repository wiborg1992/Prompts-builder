import { useState, useEffect, useRef } from "react";
import { useLiveTranscription } from "@/hooks/use-live-transcription";
import {
  useAddContextItem,
  useGeneratePrompt,
  getListContextItemsQueryKey,
  getGetSessionSummaryQueryKey,
  getListPromptsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
  Sparkles,
} from "lucide-react";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

type WorkflowState = "idle" | "recording" | "paused" | "processing";

export function RecordingWorkspace({ sessionId }: { sessionId: number }) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<"deepgram" | "openai">("deepgram");
  const [language, setLanguage] = useState("en");
  const [workflowState, setWorkflowState] = useState<WorkflowState>("idle");
  const [processingStep, setProcessingStep] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
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

  const addItem = useAddContextItem();
  const generatePrompt = useGeneratePrompt({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setWorkflowState("idle");
        setProcessingStep("");
      },
      onError: () => {
        setWorkflowState("idle");
        setProcessingStep("");
      },
    },
  });

  useEffect(() => {
    if (isRecording && !isPaused) {
      setWorkflowState("recording");
    } else if (isPaused) {
      setWorkflowState("paused");
    }
  }, [isRecording, isPaused]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalTranscript, interimText]);

  const handleStart = async () => {
    setWorkflowState("recording");
    await startRecording();
  };

  const handlePause = () => {
    pauseRecording();
  };

  const handleResume = () => {
    resumeRecording();
  };

  const handleStop = async () => {
    const transcript = stopRecording();
    if (!transcript.trim()) {
      setWorkflowState("idle");
      return;
    }

    setWorkflowState("processing");
    setProcessingStep("Saving transcript...");

    try {
      await addItem.mutateAsync({
        sessionId,
        data: {
          type: "transcript" as const,
          label: `Recording — ${provider === "deepgram" ? "Deepgram" : "OpenAI"} (${language === "da" ? "Danish" : "English"})`,
          content: transcript.trim(),
        },
      });

      queryClient.invalidateQueries({ queryKey: getListContextItemsQueryKey(sessionId) });
      queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });

      setProcessingStep("Generating prompt from transcript...");

      generatePrompt.mutate({
        sessionId,
        data: {
          instruction: undefined,
        },
      });
    } catch {
      setWorkflowState("idle");
      setProcessingStep("");
    }
  };

  const isIdle = workflowState === "idle";
  const isActive = workflowState === "recording";
  const isPausedState = workflowState === "paused";
  const isProcessing = workflowState === "processing";

  return (
    <div className="flex flex-col h-full" data-testid="recording-workspace">
      <div className="flex-none p-4 border-b border-border bg-card/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              isActive ? "bg-red-500 animate-pulse" : 
              isPausedState ? "bg-amber-500" : 
              isProcessing ? "bg-blue-500 animate-pulse" :
              "bg-zinc-600"
            }`} />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {isActive ? "Recording" : isPausedState ? "Paused" : isProcessing ? processingStep : "Ready"}
            </span>
            {(isActive || isPausedState) && (
              <span className="text-sm font-mono text-foreground">{formatTime(elapsedSeconds)}</span>
            )}
          </div>

          {isIdle && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-muted-foreground" />
                <Select value={language} onValueChange={setLanguage}>
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
                <Select value={provider} onValueChange={(v) => setProvider(v as "deepgram" | "openai")}>
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

          {isActive && (
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
                Stop & Generate
              </Button>
            </>
          )}

          {isPausedState && (
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
                Stop & Generate
              </Button>
            </>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 text-primary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">{processingStep}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex-none px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <span className="text-xs text-destructive">{error}</span>
        </div>
      )}

      <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto">
          {!finalTranscript && !interimText && isIdle && (
            <div className="text-center py-20">
              <MicOff className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
              <p className="text-lg text-muted-foreground">Ready to record</p>
              <p className="text-sm text-muted-foreground/70 mt-2 max-w-md mx-auto">
                Select your language and transcription provider, then press Start Recording.
                The transcript will appear here in real time as you speak.
              </p>
            </div>
          )}

          {!finalTranscript && !interimText && isActive && (
            <div className="text-center py-20">
              <div className="flex items-center justify-center gap-1.5 mb-4">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{
                      height: `${12 + Math.random() * 28}px`,
                      animationDelay: `${i * 0.12}s`,
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

          {isProcessing && finalTranscript && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-card/50 border border-border/50">
                <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                  {finalTranscript}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 py-6 text-primary animate-in fade-in">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span className="text-sm font-medium">{processingStep}</span>
              </div>
            </div>
          )}

          {(finalTranscript || interimText) && !isProcessing && (
            <div className="space-y-1">
              <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                {finalTranscript}
                {interimText && (
                  <span className="text-muted-foreground/50 italic"> {interimText}</span>
                )}
              </p>
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
