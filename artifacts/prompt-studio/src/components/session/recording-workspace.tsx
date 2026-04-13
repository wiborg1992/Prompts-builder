import { useState, useEffect, useRef } from "react";
import { useDeepgramSpeech, type TranscriptSegment as LiveSegment } from "@/hooks/use-deepgram-speech";
import {
  useListTranscriptSegments,
  useAddTranscriptSegmentsBatch,
  useGeneratePrompt,
  getListTranscriptSegmentsQueryKey,
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
  Square,
  Languages,
  Loader2,
  Sparkles,
  User,
} from "lucide-react";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatTimestamp(ts: string | number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const SPEAKER_COLORS = [
  "text-blue-400",
  "text-emerald-400",
  "text-amber-400",
  "text-purple-400",
  "text-rose-400",
  "text-cyan-400",
  "text-orange-400",
  "text-teal-400",
];

function getSpeakerColor(speaker: string): string {
  const match = speaker.match(/\d+/);
  const idx = match ? parseInt(match[0]) : 0;
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
}

type WorkflowState = "idle" | "recording" | "processing";

export function RecordingWorkspace({ sessionId, onPromptGenerated }: { sessionId: number; onPromptGenerated?: () => void }) {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState("en");
  const [workflowState, setWorkflowState] = useState<WorkflowState>("idle");
  const [processingStep, setProcessingStep] = useState("");
  const [stoppedSegments, setStoppedSegments] = useState<LiveSegment[]>([]);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const { data: savedSegments, isLoading: segmentsLoading } = useListTranscriptSegments(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getListTranscriptSegmentsQueryKey(sessionId),
    },
  });

  const {
    isRecording,
    interimText,
    error,
    segments: liveSegments,
    elapsedSeconds,
    startRecording,
    stopRecording,
  } = useDeepgramSpeech({ language });

  const addSegmentsBatch = useAddTranscriptSegmentsBatch();
  const generatePrompt = useGeneratePrompt({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setWorkflowState("idle");
        setProcessingStep("");
        onPromptGenerated?.();
      },
      onError: () => {
        setWorkflowState("idle");
        setProcessingStep("");
      },
    },
  });

  useEffect(() => {
    if (isRecording) {
      setWorkflowState("recording");
    }
  }, [isRecording]);

  useEffect(() => {
    if (error && workflowState === "recording") {
      setWorkflowState("idle");
    }
  }, [error, workflowState]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [savedSegments, liveSegments, interimText]);

  const handleStart = async () => {
    setStoppedSegments([]);
    await startRecording();
  };

  const handleStop = async () => {
    const finalSegments = stopRecording();
    setStoppedSegments(finalSegments);

    if (finalSegments.length === 0) {
      setWorkflowState("idle");
      return;
    }

    setWorkflowState("processing");
    setProcessingStep("Saving transcript...");

    const recordingId = `rec-${Date.now()}`;

    try {
      await addSegmentsBatch.mutateAsync({
        sessionId,
        data: {
          segments: finalSegments.map((s) => ({
            speaker: s.speaker,
            text: s.text,
            language: language,
            recordingId,
          })),
        },
      });

      await queryClient.invalidateQueries({ queryKey: getListTranscriptSegmentsQueryKey(sessionId) });
      queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
      setStoppedSegments([]);

      setProcessingStep("Generating prompt from transcript...");

      generatePrompt.mutate({
        sessionId,
        data: { instruction: undefined },
      });
    } catch {
      setWorkflowState("idle");
      setProcessingStep("");
    }
  };

  const isIdle = workflowState === "idle";
  const isActive = workflowState === "recording";
  const isProcessing = workflowState === "processing";

  const hasSavedSegments = (savedSegments?.length ?? 0) > 0;
  const hasLiveSegments = liveSegments.length > 0;
  const hasStoppedSegments = stoppedSegments.length > 0;

  return (
    <div className="flex flex-col h-full" data-testid="recording-workspace">
      <div className="flex-none p-4 border-b border-border bg-card/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              isActive ? "bg-red-500 animate-pulse" :
              isProcessing ? "bg-blue-500 animate-pulse" :
              "bg-zinc-600"
            }`} />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {isActive ? "Recording" : isProcessing ? processingStep : "Ready"}
            </span>
            {isActive && (
              <span className="text-sm font-mono text-foreground">{formatTime(elapsedSeconds)}</span>
            )}
          </div>

          {isIdle && (
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
            <Button
              size="lg"
              variant="destructive"
              className="h-12 px-8 rounded-full"
              onClick={handleStop}
              data-testid="button-stop"
            >
              <Square className="w-5 h-5 mr-2" />
              Stop & Generate
            </Button>
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

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-6 space-y-1">
          {!hasSavedSegments && !hasLiveSegments && !hasStoppedSegments && !interimText && isIdle && !segmentsLoading && (
            <div className="text-center py-20">
              <MicOff className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
              <p className="text-lg text-muted-foreground">Ready to record</p>
              <p className="text-sm text-muted-foreground/70 mt-2 max-w-md mx-auto">
                Select your language and press Start Recording.
                Live transcription with speaker identification will appear here.
              </p>
            </div>
          )}

          {!hasSavedSegments && !hasLiveSegments && !hasStoppedSegments && !interimText && isActive && (
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
                Speak into your microphone. Speaker-labeled transcript will appear here.
              </p>
            </div>
          )}

          {hasSavedSegments && (
            <>
              <div className="flex items-center gap-2 py-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Transcript Log
                </span>
                <span className="text-xs text-muted-foreground/50">
                  {savedSegments!.length} segments
                </span>
              </div>
              {savedSegments!.map((seg) => (
                <SavedSegmentBlock key={seg.id} segment={seg} />
              ))}
            </>
          )}

          {hasStoppedSegments && (
            <>
              {hasSavedSegments && (
                <div className="border-t border-border/30 my-4 pt-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Just Recorded
                  </span>
                </div>
              )}
              {stoppedSegments.map((seg) => (
                <LiveSegmentBlock key={seg.id} segment={seg} />
              ))}
            </>
          )}

          {isActive && (hasSavedSegments || hasStoppedSegments) && hasLiveSegments && (
            <div className="border-t border-border/30 my-4 pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Recording
              </span>
            </div>
          )}

          {isActive && liveSegments.map((seg) => (
            <LiveSegmentBlock key={seg.id} segment={seg} />
          ))}

          {interimText && isActive && (
            <div className="py-2 px-3 rounded-lg bg-card/30 border border-border/30 animate-in fade-in">
              <p className="text-sm text-muted-foreground/60 italic leading-relaxed">
                {interimText}
              </p>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center justify-center gap-3 py-6 text-primary animate-in fade-in border-t border-border/30 mt-4">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="text-sm font-medium">{processingStep}</span>
            </div>
          )}

          <div ref={feedEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

function SavedSegmentBlock({ segment }: { segment: { id: number; speaker: string; text: string; createdAt: string } }) {
  const color = getSpeakerColor(segment.speaker);

  return (
    <div className="py-3 px-3 rounded-lg hover:bg-card/30 transition-colors group">
      <div className="flex items-center gap-2 mb-1">
        <User className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-xs font-semibold ${color}`}>{segment.speaker}</span>
        <span className="text-xs text-muted-foreground/40">{formatTimestamp(segment.createdAt)}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90 pl-5.5">
        {segment.text}
      </p>
    </div>
  );
}

function LiveSegmentBlock({ segment }: { segment: LiveSegment }) {
  const color = getSpeakerColor(segment.speaker);

  return (
    <div className="py-3 px-3 rounded-lg hover:bg-card/30 transition-colors group">
      <div className="flex items-center gap-2 mb-1">
        <User className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-xs font-semibold ${color}`}>{segment.speaker}</span>
        <span className="text-xs text-muted-foreground/40">{formatTimestamp(segment.timestamp)}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90 pl-5.5">
        {segment.text}
      </p>
    </div>
  );
}
