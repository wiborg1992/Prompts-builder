import { useParams } from "wouter";
import { Link } from "wouter";
import { 
  useGetSession, 
  getGetSessionQueryKey,
  useGetSessionSummary,
  getGetSessionSummaryQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ContextPanel } from "@/components/session/context-panel";
import { PromptPanel } from "@/components/session/prompt-panel";

export default function SessionWorkspace() {
  const params = useParams();
  const sessionId = Number(params.id);

  const { data: session, isLoading: sessionLoading } = useGetSession(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionQueryKey(sessionId)
    }
  });

  const { data: summary } = useGetSessionSummary(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionSummaryQueryKey(sessionId)
    }
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
      {/* Header */}
      <header className="flex-none h-16 border-b border-border bg-card/30 backdrop-blur-md flex items-center justify-between px-4 lg:px-6">
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
              <span className="text-xs text-muted-foreground mt-1" data-testid="text-session-desc">
                {session.description}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          {summary && (
            <>
              <span data-testid="text-context-count">{summary.contextCount} Items</span>
              <span>&bull;</span>
              <span data-testid="text-prompt-count">{summary.promptCount} Prompts</span>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Context Panel */}
        <section className="flex-1 lg:w-1/2 flex flex-col min-h-0 border-r border-border bg-card/10">
          <ContextPanel sessionId={sessionId} />
        </section>

        {/* Right: Prompt Panel */}
        <section className="flex-1 lg:w-1/2 flex flex-col min-h-0 bg-background">
          <PromptPanel sessionId={sessionId} />
        </section>
      </main>
    </div>
  );
}
