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
import { Sparkles, Edit2, Check, X, Trash2, Copy, History } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export function PromptPanel({ sessionId }: { sessionId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [instruction, setInstruction] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: prompts, isLoading } = useListPrompts(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getListPromptsQueryKey(sessionId)
    }
  });

  const generatePrompt = useGeneratePrompt({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPromptsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setInstruction("");
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

  const latestPrompt = prompts?.[0];
  const historyPrompts = prompts?.slice(1) || [];

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
      </div>

      <ScrollArea className="flex-1 p-4 lg:p-6">
        <div className="space-y-8 max-w-3xl mx-auto">
          {isLoading ? (
            <div className="h-64 bg-muted rounded-xl animate-pulse" />
          ) : latestPrompt ? (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                <span>Latest Version (v{latestPrompt.version})</span>
                <span>{format(new Date(latestPrompt.createdAt), 'h:mm a')}</span>
              </div>
              
              <Card className="border-primary/30 shadow-lg shadow-primary/5 bg-card" data-testid="card-latest-prompt">
                <CardHeader className="p-3 border-b border-border/50 bg-card flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    {latestPrompt.instruction ? (
                      <span className="text-xs bg-secondary px-2 py-1 rounded-md text-secondary-foreground font-medium">
                        Goal: {latestPrompt.instruction}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Standard generation</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {editingId === latestPrompt.id ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-8">
                          <X className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(latestPrompt.id)} disabled={updatePrompt.isPending} className="h-8">
                          <Check className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleEdit(latestPrompt)} data-testid="button-edit-prompt">
                          <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleCopy(latestPrompt.content)} data-testid="button-copy-prompt">
                          <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {editingId === latestPrompt.id ? (
                    <Textarea 
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[300px] border-0 focus-visible:ring-0 rounded-none rounded-b-lg font-mono text-sm leading-relaxed p-4 bg-background"
                      data-testid="input-edit-prompt"
                      autoFocus
                    />
                  ) : (
                    <div className="p-4 bg-background rounded-b-lg min-h-[300px]">
                      <pre className="font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                        {latestPrompt.content}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-24 px-4 border border-dashed border-border rounded-xl">
              <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">No prompts generated yet.</p>
              <p className="text-muted-foreground text-xs mt-1">Add context items and click generate to compose a prompt.</p>
            </div>
          )}

          {historyPrompts.length > 0 && (
            <div className="mt-12 space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground px-1 border-b border-border/50 pb-2">
                <History className="w-4 h-4" />
                <h3 className="text-sm font-medium">History</h3>
              </div>
              
              <div className="space-y-4">
                {historyPrompts.map((prompt) => (
                  <Card key={prompt.id} className="opacity-80 hover:opacity-100 transition-opacity bg-card" data-testid={`card-history-prompt-${prompt.id}`}>
                    <CardHeader className="p-3 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">v{prompt.version}</span>
                        <span className="text-xs text-muted-foreground">&bull;</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(prompt.createdAt), 'MMM d, h:mm a')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                         <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleCopy(prompt.content)} title="Copy">
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-7 h-7 hover:text-destructive hover:bg-destructive/10" 
                          onClick={() => deletePrompt.mutate({ id: prompt.id })}
                          disabled={deletePrompt.isPending}
                          title="Delete"
                          data-testid={`button-delete-prompt-${prompt.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 bg-background/50 max-h-[150px] overflow-hidden relative">
                      <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                        {prompt.content}
                      </pre>
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
