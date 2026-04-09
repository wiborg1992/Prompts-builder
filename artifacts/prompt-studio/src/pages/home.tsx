import { Link } from "wouter";
import { 
  useListSessions, 
  useCreateSession, 
  getListSessionsQueryKey,
  useGetSessionSummary,
  getGetSessionSummaryQueryKey,
  Session
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, ArrowRight, LayoutTemplate, Layers, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SessionCard({ session }: { session: Session }) {
  const { data: summary } = useGetSessionSummary(session.id, {
    query: {
      enabled: true,
      queryKey: getGetSessionSummaryQueryKey(session.id)
    }
  });

  return (
    <Link href={`/sessions/${session.id}`} className="block group">
      <Card className="h-full border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm relative overflow-hidden flex flex-col" data-testid={`card-session-${session.id}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <CardHeader className="flex-none pb-2">
          <CardTitle className="text-xl">{session.title}</CardTitle>
          <CardDescription className="line-clamp-1 h-5">
            {session.description || "No description"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 justify-between pb-2">
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            {summary ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 bg-background/50 px-2.5 py-1 rounded-md border border-border/30">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium text-foreground">{summary.contextCount}</span>
                  <span className="text-xs">Context</span>
                </div>
                <div className="flex items-center gap-1.5 bg-background/50 px-2.5 py-1 rounded-md border border-border/30">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium text-foreground">{summary.promptCount}</span>
                  <span className="text-xs">Prompts</span>
                </div>
              </div>
            ) : (
              <div className="h-7 w-32 bg-muted/50 rounded-md animate-pulse" />
            )}

            {summary?.latestPromptPreview ? (
              <div className="bg-background/80 rounded-md p-3 border border-border/30">
                <p className="text-xs font-mono text-muted-foreground line-clamp-3 font-sans">
                  "{summary.latestPromptPreview}"
                </p>
              </div>
            ) : (
              <div className="text-xs italic text-muted-foreground/60 py-2">
                No prompt generated yet.
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex-none pt-4 border-t border-border/50 flex justify-between items-center text-primary bg-card/20">
          <div className="text-xs text-muted-foreground">
            Updated {format(new Date(session.updatedAt), 'MMM d')}
          </div>
          <div className="flex items-center gap-1 text-sm font-medium">
            Open Workspace
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

export default function Home() {
  const { data: sessions, isLoading } = useListSessions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const queryClient = useQueryClient();
  const createSession = useCreateSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setIsDialogOpen(false);
        setNewTitle("");
        setNewDescription("");
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createSession.mutate({
      data: {
        title: newTitle,
        description: newDescription || undefined
      }
    });
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/50 pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground font-mono uppercase tracking-wider" data-testid="heading-title">
              Prompt Studio
            </h1>
            <p className="text-muted-foreground text-lg" data-testid="heading-subtitle">
              Compose context-driven design prompts with precision.
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-session" size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow">
                <Plus className="w-5 h-5" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" data-testid="dialog-new-session">
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create New Session</DialogTitle>
                  <DialogDescription>
                    Start a new workspace to gather context and generate prompts.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="E.g., Mobile Onboarding Flow"
                      autoFocus
                      data-testid="input-session-title"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Gathering notes for the mobile app redesign"
                      data-testid="input-session-description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!newTitle.trim() || createSession.isPending} data-testid="button-submit-session">
                    {createSession.isPending ? "Creating..." : "Create Session"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-xl bg-muted/30 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="list-sessions">
            {sessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 px-6 border border-dashed border-border/50 rounded-xl bg-card/10 backdrop-blur-sm" data-testid="empty-state-sessions">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <LayoutTemplate className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-3">Workbench is empty</h3>
            <p className="text-muted-foreground max-w-sm text-center mb-8">
              Create a new session to start gathering your raw materials and generating highly contextual design prompts.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline" size="lg" className="border-primary/20 hover:bg-primary/5" data-testid="button-empty-new-session">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Session
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
