import { useState } from "react";
import {
  useListPrompts,
  getListPromptsQueryKey,
  useGeneratePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  getGetSessionSummaryQueryKey,
  GeneratedPrompt
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sparkles, Edit2, Check, X, Trash2, Copy, ChevronDown } from "lucide-react";
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

export function PromptPanel({ sessionId }: { sessionId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [instruction, setInstruction] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: prompts, isLoading } = useListPrompts(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getListPromptsQueryKey(sessionId)
    }
  });

  const generatePrompt = useGeneratePrompt({
    mutation: {
      onSuccess: (newPrompt) => {
        queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setInstruction("");
        setSelectedId(newPrompt.id);
        setEditingId(null);
      }
    }
  });

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

  const handleGenerate = () => {
    generatePrompt.mutate({
      sessionId,
      data: {
        instruction: instruction.trim() || undefined
      }
    });
  };

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
      title: "Copied to clipboard",
      description: "Prompt is ready to use.",
    });
  };

  const sortedPrompts = prompts ? [...prompts].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ) : [];

  const effectiveSelectedId = selectedId ?? sortedPrompts[0]?.id ?? null;
  const selectedPrompt = sortedPrompts.find(p => p.id === effectiveSelectedId) ?? sortedPrompts[0] ?? null;

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="flex-none p-4 border-b border-border bg-background flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2" data-testid="heading-prompt-panel">
            <Sparkles className="w-4 h-4 text-primary" />
            Prompt Output
          </h2>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Optional instruction (e.g. 'Make it focused on accessibility')"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="flex-1"
            data-testid="input-prompt-instruction"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <Button
            onClick={handleGenerate}
            disabled={generatePrompt.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            data-testid="button-generate-prompt"
          >
            {generatePrompt.isPending ? (
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Generating...
              </span>
            ) : (
              "Generate"
            )}
          </Button>
        </div>

        {sortedPrompts.length > 0 && (
          <Select
            value={String(effectiveSelectedId)}
            onValueChange={(val) => {
              setSelectedId(Number(val));
              setEditingId(null);
            }}
          >
            <SelectTrigger className="w-full bg-background border-border/60" data-testid="select-prompt-version">
              <SelectValue placeholder="Select a prompt version" />
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
                    {selectedPrompt.instruction ? (
                      <span className="text-xs bg-secondary px-2 py-1 rounded-md text-secondary-foreground font-medium">
                        Mål: {selectedPrompt.instruction}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Standard generering</span>
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
                          className="w-8 h-8 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deletePrompt.mutate({ id: selectedPrompt.id })}
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
                    <div className="p-4 bg-background rounded-b-lg">
                      <pre className="font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                        {selectedPrompt.content}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
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
