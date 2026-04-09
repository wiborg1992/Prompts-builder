import { useParams } from "wouter";
import { Link } from "wouter";
import {
  useGetSession,
  getGetSessionQueryKey,
  useGetSessionSummary,
  getGetSessionSummaryQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Mic, FolderOpen, Sparkles } from "lucide-react";
import { RecordingWorkspace } from "@/components/session/recording-workspace";
import { ContextPanel } from "@/components/session/context-panel";
import { PromptPanel } from "@/components/session/prompt-panel";

export default function SessionWorkspace() {
  const params = useParams();
  const sessionId = Number(params.id);

  const { data: session, isLoading: sessionLoading } = useGetSession(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionQueryKey(sessionId),
    },
  });

  const { data: summary } = useGetSessionSummary(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionSummaryQueryKey(sessionId),
    },
  });

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h2 className="text-xl text-foreground">Session not found</h2>
        <Link href="/">
          <Button variant="outline">Return Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="flex-none h-14 border-b border-border bg-card/30 backdrop-blur-md flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="w-8 h-8" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold text-foreground leading-none" data-testid="text-session-title">
              {session.title}
            </h1>
            {session.description && (
              <span className="text-xs text-muted-foreground mt-0.5" data-testid="text-session-desc">
                {session.description}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          {summary && (
            <>
              {(summary.transcriptSegmentCount ?? 0) > 0 && (
                <>
                  <span data-testid="text-transcript-count">{summary.transcriptSegmentCount} Transcript</span>
                  <span>&bull;</span>
                </>
              )}
              <span data-testid="text-context-count">{summary.contextCount} Context</span>
              <span>&bull;</span>
              <span data-testid="text-prompt-count">{summary.promptCount} Prompts</span>
            </>
          )}
        </div>
      </header>

      <Tabs defaultValue="record" className="flex-1 flex flex-col min-h-0">
        <div className="flex-none border-b border-border bg-card/20">
          <TabsList className="h-10 bg-transparent rounded-none border-none px-4 gap-1">
            <TabsTrigger
              value="record"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 text-sm gap-2"
              data-testid="tab-record"
            >
              <Mic className="w-4 h-4" />
              Record
            </TabsTrigger>
            <TabsTrigger
              value="context"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 text-sm gap-2"
              data-testid="tab-context"
            >
              <FolderOpen className="w-4 h-4" />
              Context
              {summary && summary.contextCount > 0 && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {summary.contextCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="prompts"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md px-4 text-sm gap-2"
              data-testid="tab-prompts"
            >
              <Sparkles className="w-4 h-4" />
              Prompts
              {summary && summary.promptCount > 0 && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {summary.promptCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="record" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <RecordingWorkspace sessionId={sessionId} />
        </TabsContent>

        <TabsContent value="context" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <ContextPanel sessionId={sessionId} />
        </TabsContent>

        <TabsContent value="prompts" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
          <PromptPanel sessionId={sessionId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
