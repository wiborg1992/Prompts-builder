import { useState, useMemo } from "react";
import { marked } from "marked";
import {
  useListPrompts,
  getListPromptsQueryKey,
  useGeneratePrompt,
  useClarifyPrompt,
  useUpdatePrompt,
  useDeletePrompt,
  getGetSessionSummaryQueryKey,
  GeneratedPrompt,
  SuggestedFile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sparkles, Edit2, Check, X, Trash2, Copy, Download, Paperclip, Info, HelpCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function PromptMarkdown({ content }: { content: string }) {
  const html = useMemo(() => {
    return marked.parse(content, { async: false }) as string;
  }, [content]);

  return (
    <div
      className="p-4 bg-background rounded-b-lg prose prose-sm dark:prose-invert max-w-none
        prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground
        prose-h3:text-sm prose-h3:uppercase prose-h3:tracking-wider prose-h3:mt-5 prose-h3:mb-2
        prose-p:text-sm prose-p:leading-relaxed prose-p:text-foreground
        prose-li:text-sm prose-li:text-foreground
        prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none
        prose-strong:text-foreground prose-strong:font-semibold
        prose-hr:border-border prose-hr:my-4
        prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function SuggestedFilesBox({ files }: { files: SuggestedFile[] }) {
  if (!files || files.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0 rounded-md bg-amber-500/15 p-1.5">
          <Paperclip className="w-3.5 h-3.5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
            Vedhæft disse filer i dit AI-kodningsværktøj
            <Info className="w-3 h-3 opacity-70" />
          </p>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Når du indsætter prompten i Cursor, Copilot eller et andet AI-værktøj, bør du sende disse filer med som kontekst:
          </p>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground truncate max-w-[160px]" title={f.filename}>
                  {f.filename}
                </span>
                <span className="text-xs text-muted-foreground leading-relaxed">{f.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function getAutoDownloadPref(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem("prompt-studio-auto-download");
  return stored ? stored === "true" : true;
}

type PanelState = "idle" | "checking" | "clarifying" | "generating";

export function PromptPanel({ sessionId }: { sessionId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [instruction, setInstruction] = useState("");
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: prompts, isLoading } = useListPrompts(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getListPromptsQueryKey(sessionId)
    }
  });

  const sortedPrompts = prompts ? [...prompts].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ) : [];

  const clarifyPrompt = useClarifyPrompt({
    mutation: {
      onSuccess: (data) => {
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setAnswers({});
          setPanelState("clarifying");
        } else {
          doGenerate([]);
        }
      },
      onError: () => {
        setPanelState("idle");
        toast({ title: "Noget gik galt", description: "Kunne ikke tjekke for afklaringsspørgsmål.", variant: "destructive" });
      }
    }
  });

  const generatePrompt = useGeneratePrompt({
    mutation: {
      onSuccess: (newPrompt) => {
        queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setInstruction("");
        setQuestions([]);
        setAnswers({});
        setPanelState("idle");
        setSelectedId(newPrompt.id);
        setEditingId(null);

        if (getAutoDownloadPref()) {
          const url = `/api/sessions/${sessionId}/prompts/${newPrompt.id}/export`;
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = "";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      },
      onError: () => {
        setPanelState("idle");
        toast({ title: "Generering fejlede", description: "Prøv igen om et øjeblik.", variant: "destructive" });
      }
    }
  });

  const doGenerate = (clarifications: Array<{ question: string; answer: string }>) => {
    setPanelState("generating");
    generatePrompt.mutate({
      sessionId,
      data: {
        instruction: instruction.trim() || undefined,
        clarifications: clarifications.length > 0 ? clarifications : undefined,
      }
    });
  };

  const handleGenerate = () => {
    if (panelState === "clarifying") {
      const clarifications = questions
        .map((q, i) => ({ question: q, answer: answers[i] ?? "" }))
        .filter((c) => c.answer.trim() !== "");
      doGenerate(clarifications);
      return;
    }
    setPanelState("checking");
    clarifyPrompt.mutate({
      sessionId,
      data: { instruction: instruction.trim() || undefined }
    });
  };

  const handleSkipClarification = () => {
    doGenerate([]);
  };

  const updatePrompt = useUpdatePrompt({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey(sessionId) });
        setEditingId(null);
      }
    }
  });

  const deletePrompt = useDeletePrompt({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setSelectedId(null);
        setEditingId(null);
      }
    }
  });

  const handleEdit = (prompt: GeneratedPrompt) => {
    setEditingId(prompt.id);
    setEditContent(prompt.content);
  };

  const handleSaveEdit = (id: number) => {
    if (!editContent.trim()) return;
    updatePrompt.mutate({
      sessionId,
      id,
      data: { content: editContent }
    });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Kopieret til udklipsholder",
      description: "Prompten er klar til brug.",
    });
  };

  const handleDownload = (prompt: GeneratedPrompt) => {
    const url = `/api/sessions/${sessionId}/prompts/${prompt.id}/export`;
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const effectiveSelectedId = selectedId ?? sortedPrompts[0]?.id ?? null;
  const selectedPrompt = sortedPrompts.find(p => p.id === effectiveSelectedId) ?? sortedPrompts[0] ?? null;

  const isWorking = panelState === "checking" || panelState === "generating";

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="flex-none p-4 border-b border-border bg-background flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2" data-testid="heading-prompt-panel">
            <Sparkles className="w-4 h-4 text-primary" />
            Prompt Output
          </h2>
        </div>

        {panelState === "clarifying" ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary mb-0.5">Et par afklarende spørgsmål</p>
                <p className="text-xs text-muted-foreground">
                  Besvar dem for et mere præcist resultat — eller spring over og generer nu.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="space-y-1.5">
                  <label className="text-xs text-foreground font-medium">{q}</label>
                  <Input
                    placeholder="Dit svar (valgfrit)"
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                    className="text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleGenerate}
                disabled={isWorking}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                data-testid="button-generate-prompt"
              >
                {isWorking ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Genererer...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Generer
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkipClarification}
                disabled={isWorking}
                className="text-muted-foreground text-sm"
              >
                Spring over
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Valgfri instruktion (f.eks. 'Fokuser på tilgængelighed')"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="flex-1"
              data-testid="input-prompt-instruction"
              disabled={isWorking}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
            <Button
              onClick={handleGenerate}
              disabled={isWorking}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
              data-testid="button-generate-prompt"
            >
              {panelState === "checking" ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Tjekker...
                </span>
              ) : panelState === "generating" ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Genererer...
                </span>
              ) : "Generer"}
            </Button>
          </div>
        )}

        {sortedPrompts.length > 0 && (
          <Select
            value={String(effectiveSelectedId)}
            onValueChange={(val) => {
              setSelectedId(Number(val));
              setEditingId(null);
            }}
          >
            <SelectTrigger className="w-full bg-background border-border/60" data-testid="select-prompt-version">
              <SelectValue placeholder="Vælg en promptversion" />
            </SelectTrigger>
            <SelectContent>
              {sortedPrompts.map((prompt, index) => (
                <SelectItem key={prompt.id} value={String(prompt.id)}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">v{prompt.version}</span>
                    <span className="text-muted-foreground">—</span>
                    <span>{format(new Date(prompt.createdAt), 'MMM d, HH:mm')}</span>
                    {index === 0 && (
                      <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Seneste</span>
                    )}
                    {prompt.instruction && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">· {prompt.instruction}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <ScrollArea className="flex-1 p-4 lg:p-6">
        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="h-64 bg-muted rounded-xl animate-pulse" />
          ) : selectedPrompt ? (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4">
              <Card className="border-primary/30 shadow-lg shadow-primary/5 bg-card" data-testid="card-latest-prompt">
                <CardHeader className="p-3 border-b border-border/50 bg-card flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      v{selectedPrompt.version}
                    </span>
                    {selectedPrompt.instruction ? (
                      <span className="text-xs bg-secondary px-2 py-1 rounded-md text-secondary-foreground font-medium">
                        {selectedPrompt.instruction}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(selectedPrompt.createdAt), 'MMM d, HH:mm')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {editingId === selectedPrompt.id ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-8">
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(selectedPrompt.id)} disabled={updatePrompt.isPending} className="h-8">
                          <Check className="w-4 h-4 mr-1" />
                          Gem
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleEdit(selectedPrompt)} data-testid="button-edit-prompt">
                          <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleCopy(selectedPrompt.content)} data-testid="button-copy-prompt">
                          <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => handleDownload(selectedPrompt)}
                          title="Download som .txt"
                        >
                          <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deletePrompt.mutate({ sessionId, id: selectedPrompt.id })}
                          disabled={deletePrompt.isPending}
                          data-testid={`button-delete-prompt-${selectedPrompt.id}`}
                          title="Slet prompt"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {editingId === selectedPrompt.id ? (
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[400px] border-0 focus-visible:ring-0 rounded-none rounded-b-lg font-mono text-sm leading-relaxed p-4 bg-background"
                      data-testid="input-edit-prompt"
                      autoFocus
                    />
                  ) : (
                    <PromptMarkdown content={selectedPrompt.content} />
                  )}
                </CardContent>
              </Card>

              {selectedPrompt.suggestedFiles && selectedPrompt.suggestedFiles.length > 0 && (
                <SuggestedFilesBox files={selectedPrompt.suggestedFiles} />
              )}
            </div>
          ) : (
            <div className="text-center py-24 px-4 border border-dashed border-border rounded-xl">
              <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Ingen prompts genereret endnu.</p>
              <p className="text-muted-foreground text-xs mt-1">Tilføj kontekst og klik på Generate for at komponere en prompt.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
