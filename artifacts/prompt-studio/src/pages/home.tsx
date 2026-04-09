import { Link } from "wouter";
import { 
  useListSessions, 
  useCreateSession, 
  useDeleteSession,
  getListSessionsQueryKey,
  useGetSessionSummary,
  getGetSessionSummaryQueryKey,
  Session
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, ArrowRight, LayoutTemplate, Layers, MessageSquare, Trash2, Download } from "lucide-react";
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

async function exportSession(session: Session) {
  const [contextRes, promptsRes, transcriptsRes] = await Promise.all([
    fetch(`/api/sessions/${session.id}/context`),
    fetch(`/api/sessions/${session.id}/prompts`),
    fetch(`/api/sessions/${session.id}/transcripts`),
  ]);

  const [context, prompts, transcripts] = await Promise.all([
    contextRes.json(),
    promptsRes.json(),
    transcriptsRes.json(),
  ]);

  const exportData = {
    session: {
      id: session.id,
      title: session.title,
      description: session.description,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    exportedAt: new Date().toISOString(),
    transcript: transcripts.map((s: any) => ({
      speaker: s.speaker,
      text: s.text,
      language: s.language,
      createdAt: s.createdAt,
    })),
    prompts: (prompts as any[])
      .sort((a: any, b: any) => a.version - b.version)
      .map((p: any) => ({
        version: p.version,
        instruction: p.instruction,
        content: p.content,
        createdAt: p.createdAt,
      })),
    contextItems: context.map((c: any) => ({
      type: c.type,
      label: c.label,
      content: c.content,
      filename: c.filename,
      mimeType: c.mimeType,
      fileUrl: c.fileUrl,
      createdAt: c.createdAt,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  a.href = url;
  a.download = `session-${slug}-${session.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function SessionCard({ session, onDelete }: { session: Session; onDelete: (id: number) => void }) {
  const [exporting, setExporting] = useState(false);

  const { data: summary } = useGetSessionSummary(session.id, {
    query: {
      enabled: true,
      queryKey: getGetSessionSummaryQueryKey(session.id)
    }
  });

  const handleExport = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExporting(true);
    try {
      await exportSession(session);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative group">
      <Link href={`/sessions/${session.id}`} className="block">
        <Card className="h-full border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-md bg-card/50 backdrop-blur-sm relative overflow-hidden flex flex-col" data-testid={`card-session-${session.id}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <CardHeader className="flex-none pb-2">
            <CardTitle className="text-xl pr-16">{session.title}</CardTitle>
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

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="p-1.5 rounded-md bg-background/80 border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
          title="Eksporter session"
          data-testid={`button-export-session-${session.id}`}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(session.id);
          }}
          className="p-1.5 rounded-md bg-background/80 border border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5"
          title="Slet session"
          data-testid={`button-delete-session-${session.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: sessions, isLoading } = useListSessions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
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

  const deleteSession = useDeleteSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setDeletingId(null);
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

  const handleDeleteRequest = (id: number) => {
    setDeletingId(id);
  };

  const handleDeleteConfirm = () => {
    if (deletingId !== null) {
      deleteSession.mutate({ id: deletingId });
    }
  };

  const handleDeleteAll = async () => {
    if (!sessions) return;
    for (const session of sessions) {
      await fetch(`/api/sessions/${session.id}`, { method: "DELETE" });
    }
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    setIsDeleteAllDialogOpen(false);
  };

  const sessionToDelete = sessions?.find(s => s.id === deletingId);

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

          <div className="flex items-center gap-3">
            {sessions && sessions.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/60"
                onClick={() => setIsDeleteAllDialogOpen(true)}
                data-testid="button-delete-all-sessions"
              >
                <Trash2 className="w-4 h-4" />
                Slet alle
              </Button>
            )}

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
          </div>
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
              <SessionCard key={session.id} session={session} onDelete={handleDeleteRequest} />
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

      <Dialog open={deletingId !== null} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Slet session</DialogTitle>
            <DialogDescription>
              Er du sikker på, at du vil slette <span className="font-medium text-foreground">"{sessionToDelete?.title}"</span>? Denne handling kan ikke fortrydes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Annuller
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteSession.isPending}
              data-testid="button-confirm-delete-session"
            >
              {deleteSession.isPending ? "Sletter..." : "Slet session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Slet alle sessions</DialogTitle>
            <DialogDescription>
              Er du sikker på, at du vil slette alle <span className="font-medium text-foreground">{sessions?.length} sessions</span>? Denne handling kan ikke fortrydes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteAllDialogOpen(false)}>
              Annuller
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              data-testid="button-confirm-delete-all-sessions"
            >
              Slet alle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
