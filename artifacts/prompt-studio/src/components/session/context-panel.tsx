import { useState } from "react";
import {
  useListContextItems,
  getListContextItemsQueryKey,
  useAddContextItem,
  useDeleteContextItem,
  getGetSessionSummaryQueryKey,
  ContextItemType,
  ContextItem
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, FileText, Image as ImageIcon, MessageSquare, Plus, FileQuestion, Type } from "lucide-react";
import { format } from "date-fns";

const TypeIcon = ({ type }: { type: ContextItemType }) => {
  switch (type) {
    case 'transcript': return <MessageSquare className="w-4 h-4 text-blue-400" />;
    case 'note': return <FileText className="w-4 h-4 text-amber-400" />;
    case 'image': return <ImageIcon className="w-4 h-4 text-purple-400" />;
    case 'requirement': return <FileQuestion className="w-4 h-4 text-red-400" />;
    case 'paste': return <Type className="w-4 h-4 text-emerald-400" />;
    default: return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
};

export function ContextPanel({ sessionId }: { sessionId: number }) {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useListContextItems(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getListContextItemsQueryKey(sessionId)
    }
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<ContextItemType>("note");
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");

  const addItem = useAddContextItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContextItemsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setIsAdding(false);
        setNewLabel("");
        setNewContent("");
        setNewType("note");
      }
    }
  });

  const deleteItem = useDeleteContextItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContextItemsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
      }
    }
  });

  const handleAdd = () => {
    if (!newContent.trim()) return;
    addItem.mutate({
      sessionId,
      data: {
        type: newType,
        label: newLabel.trim() || undefined,
        content: newContent
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate({ id });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-4 border-b border-border bg-card/30 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground" data-testid="heading-context">Context Workbench</h2>
        {!isAdding && (
          <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)} data-testid="button-add-context">
            <Plus className="w-4 h-4 mr-1" />
            Add Context
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {isAdding && (
            <Card className="border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-top-2" data-testid="form-add-context">
              <CardContent className="p-4 space-y-4">
                <div className="flex gap-4">
                  <div className="w-1/3">
                    <Select value={newType} onValueChange={(v) => setNewType(v as ContextItemType)}>
                      <SelectTrigger data-testid="select-context-type">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ContextItemType).map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Input 
                      placeholder="Label (Optional)" 
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      data-testid="input-context-label"
                    />
                  </div>
                </div>
                <Textarea 
                  placeholder="Paste context here..." 
                  className="min-h-[120px] font-mono text-sm resize-y bg-background"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  autoFocus
                  data-testid="input-context-content"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setIsAdding(false)} disabled={addItem.isPending} data-testid="button-cancel-context">Cancel</Button>
                  <Button onClick={handleAdd} disabled={!newContent.trim() || addItem.isPending} data-testid="button-save-context">
                    {addItem.isPending ? "Saving..." : "Save to Workbench"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : items?.length === 0 && !isAdding ? (
            <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">Workbench is empty.</p>
              <p className="text-muted-foreground text-xs mt-1">Add transcripts, notes, or requirements to build your prompt.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items?.map((item: ContextItem) => (
                <Card key={item.id} className="group border-border/50 hover:border-border transition-colors bg-card/40" data-testid={`card-context-${item.id}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon type={item.type} />
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {item.type}
                        </span>
                        {item.label && (
                          <>
                            <span className="text-muted-foreground text-xs">&bull;</span>
                            <span className="text-sm font-medium text-foreground">{item.label}</span>
                          </>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteItem.isPending}
                        data-testid={`button-delete-context-${item.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="bg-background/50 rounded-md p-3 max-h-[200px] overflow-y-auto">
                      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap font-sans">
                        {item.content}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
