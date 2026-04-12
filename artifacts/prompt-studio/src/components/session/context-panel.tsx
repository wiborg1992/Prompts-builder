import { useState, useCallback, useRef } from "react";
import {
  useListContextItems,
  getListContextItemsQueryKey,
  useAddContextItem,
  useDeleteContextItem,
  getGetSessionSummaryQueryKey,
  ContextItemType,
  ContextItem,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
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
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trash2,
  FileText,
  Image as ImageIcon,
  Plus,
  FileQuestion,
  Type,
  Upload,
  Loader2,
  File as FileIcon,
  X,
  Pencil,
  ExternalLink,
  MessageCircleQuestion,
  CheckCircle2,
} from "lucide-react";

interface ImageAnalysisState {
  loading: boolean;
  description?: string;
  questions?: string[];
  answers: string[];
  saved: boolean;
}

async function analyzeImage(
  imageUrl: string,
  context?: string
): Promise<{ description: string; questions: string[] }> {
  const res = await fetch("/api/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl: `/api/storage${imageUrl}`, context }),
  });
  if (!res.ok) throw new Error("Analysis failed");
  return res.json();
}

function ImageAnalysisPanel({
  itemId,
  analysis,
  onAnswerChange,
  onSaveAnswers,
  saving,
}: {
  itemId: number;
  analysis: ImageAnalysisState;
  onAnswerChange: (index: number, value: string) => void;
  onSaveAnswers: () => void;
  saving: boolean;
}) {
  if (analysis.loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Analyserer billedet...</span>
      </div>
    );
  }

  if (analysis.saved) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-500">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Svar gemt som kontekst</span>
      </div>
    );
  }

  if (!analysis.questions || analysis.questions.length === 0) return null;

  const hasAnyAnswer = analysis.answers.some((a) => a.trim().length > 0);

  return (
    <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
      <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <MessageCircleQuestion className="w-3.5 h-3.5" />
        <span>Opfølgningsspørgsmål om dette billede</span>
      </div>
      {analysis.description && (
        <p className="text-xs text-muted-foreground italic">{analysis.description}</p>
      )}
      <div className="space-y-2.5">
        {analysis.questions.map((q, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs text-foreground/80">{q}</p>
            <Textarea
              placeholder="Dit svar..."
              className="min-h-[56px] text-xs resize-none bg-background/80"
              value={analysis.answers[i] ?? ""}
              onChange={(e) => onAnswerChange(i, e.target.value)}
            />
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={onSaveAnswers}
        disabled={!hasAnyAnswer || saving}
        className="w-full text-xs"
      >
        {saving ? "Gemmer..." : "Gem svar som kontekst"}
      </Button>
    </div>
  );
}

const TypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "note":
      return <FileText className="w-4 h-4 text-amber-400" />;
    case "image":
      return <ImageIcon className="w-4 h-4 text-purple-400" />;
    case "requirement":
      return <FileQuestion className="w-4 h-4 text-red-400" />;
    case "paste":
      return <Type className="w-4 h-4 text-emerald-400" />;
    case "file":
      return <FileIcon className="w-4 h-4 text-cyan-400" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
};

const textTypes: ContextItemType[] = ["note", "paste", "requirement"];

const MIME_FROM_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "text/xml",
  ".html": "text/html",
  ".htm": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function isTextType(type: ContextItemType): boolean {
  return textTypes.includes(type);
}

interface PendingUpload {
  id: string;
  file: File;
  status: "uploading" | "saving" | "done" | "error";
  progress: number;
  error?: string;
}

export function ContextPanel({ sessionId }: { sessionId: number }) {
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useListContextItems(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getListContextItemsQueryKey(sessionId),
    },
  });

  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<ContextItem | null>(null);
  const [newType, setNewType] = useState<ContextItemType>("note");
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [imageAnalyses, setImageAnalyses] = useState<Record<number, ImageAnalysisState>>({});
  const [savingAnswers, setSavingAnswers] = useState<Record<number, boolean>>({});

  const { uploadFile } = useUpload({
    onSuccess: () => {},
    onError: () => {},
  });

  const addItem = useAddContextItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContextItemsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
      },
    },
  });

  const deleteItem = useDeleteContextItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContextItemsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
      },
    },
  });

  const handleAdd = () => {
    if (!newContent.trim()) return;
    addItem.mutate(
      {
        sessionId,
        data: {
          type: newType,
          label: newLabel.trim() || undefined,
          content: newContent,
        },
      },
      {
        onSuccess: () => {
          setIsAdding(false);
          setNewLabel("");
          setNewContent("");
          setNewType("note");
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate({ sessionId, id });
  };

  const handleEdit = (item: ContextItem) => {
    setIsAdding(true);
    setEditingItem(item);
    setNewType(item.type);
    setNewLabel(item.label || item.filename || "");
    setNewContent(item.content || "");
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setPendingUploads((prev) => [
        ...prev,
        { id: uploadId, file, status: "uploading", progress: 0 },
      ]);

      const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
      const resolvedMimeType = file.type || MIME_FROM_EXT[ext] || "application/octet-stream";

      try {
        const response = await uploadFile(file);

        setPendingUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, status: "saving" as const, progress: 100 } : u))
        );

        const savedItem = await addItem.mutateAsync({
          sessionId,
          data: {
            type: newType,
            label: file.name,
            content: file.name,
            fileUrl: response?.objectPath || "",
            filename: file.name,
            mimeType: resolvedMimeType,
          },
        });

        setPendingUploads((prev) => prev.filter((u) => u.id !== uploadId));

        if (newType === "image" && savedItem?.id && response?.objectPath) {
          const itemId = savedItem.id;
          setImageAnalyses((prev) => ({
            ...prev,
            [itemId]: { loading: true, answers: [], saved: false },
          }));
          try {
            const result = await analyzeImage(response.objectPath);
            setImageAnalyses((prev) => ({
              ...prev,
              [itemId]: {
                loading: false,
                description: result.description,
                questions: result.questions,
                answers: result.questions.map(() => ""),
                saved: false,
              },
            }));
          } catch {
            setImageAnalyses((prev) => ({
              ...prev,
              [itemId]: { loading: false, answers: [], saved: false },
            }));
          }
        }
      } catch (err: any) {
        setPendingUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? { ...u, status: "error" as const, error: err?.message || "Upload failed" }
              : u
          )
        );
      }
    },
    [uploadFile, addItem, sessionId, newType]
  );

  const handleFilesSelect = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => handleFileUpload(file));
    },
    [handleFileUpload]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesSelect(files);
      e.target.value = "";
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) handleFilesSelect(files);
    },
    [handleFilesSelect]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const dismissUploadError = (uploadId: string) => {
    setPendingUploads((prev) => prev.filter((u) => u.id !== uploadId));
  };

  const handleAnswerChange = (itemId: number, index: number, value: string) => {
    setImageAnalyses((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const newAnswers = [...existing.answers];
      newAnswers[index] = value;
      return { ...prev, [itemId]: { ...existing, answers: newAnswers } };
    });
  };

  const handleSaveAnswers = async (item: ContextItem) => {
    const analysis = imageAnalyses[item.id];
    if (!analysis || !analysis.questions) return;
    setSavingAnswers((prev) => ({ ...prev, [item.id]: true }));
    const imageRef = item.filename || item.label || "billede";
    for (let i = 0; i < analysis.questions.length; i++) {
      const answer = analysis.answers[i]?.trim();
      if (!answer) continue;
      await addItem.mutateAsync({
        sessionId,
        data: {
          type: "note",
          label: `${imageRef} — ${analysis.questions[i]}`,
          content: answer,
        },
      });
    }
    setSavingAnswers((prev) => ({ ...prev, [item.id]: false }));
    setImageAnalyses((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], saved: true },
    }));
  };

  const acceptTypes =
    newType === "image"
      ? "image/png,image/jpeg,image/jpg,image/webp"
      : ".pdf,.docx,.txt,.md,.doc,.csv,.json";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-4 border-b border-border bg-card/30 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Context
        </h2>
        {!isAdding && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAdding(true)}
            data-testid="button-add-context"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Context
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {isAdding && (
            <Card
              className="border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-top-2"
              data-testid="form-add-context"
            >
              <CardContent className="p-4 space-y-4">
                <div className="flex gap-4">
                  <div className="w-1/3">
                    <Select
                      value={newType}
                      onValueChange={(v) => setNewType(v as ContextItemType)}
                    >
                      <SelectTrigger data-testid="select-context-type">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="paste">Paste</SelectItem>
                        <SelectItem value="requirement">Requirement</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isTextType(newType) && (
                    <div className="flex-1">
                      <Input
                        placeholder="Label (Optional)"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        data-testid="input-context-label"
                      />
                    </div>
                  )}
                </div>

                {isTextType(newType) ? (
                  <Textarea
                    placeholder={
                      newType === "requirement"
                        ? "Enter requirement..."
                        : "Paste or type context here..."
                    }
                    className="min-h-[120px] font-mono text-sm resize-y bg-background"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    autoFocus
                    data-testid="input-context-content"
                  />
                ) : editingItem?.fileUrl ? (
                  <div className="space-y-3">
                    <div className="bg-background/70 border border-border/50 rounded-lg p-3 flex items-center gap-3">
                      {editingItem.type === "image" ? (
                        <ImageIcon className="w-5 h-5 text-purple-400 shrink-0" />
                      ) : (
                        <FileIcon className="w-5 h-5 text-cyan-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {editingItem.filename || "Uploaded file"}
                        </p>
                        {editingItem.mimeType && (
                          <p className="text-xs text-muted-foreground">{editingItem.mimeType}</p>
                        )}
                      </div>
                      <a
                        href={`/api/storage${editingItem.fileUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors shrink-0 font-medium"
                      >
                        Åbn fil
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    {editingItem.type === "image" && (
                      <div className="rounded-md overflow-hidden bg-background/50 max-h-[180px]">
                        <img
                          src={`/api/storage${editingItem.fileUrl}`}
                          alt={editingItem.filename || "uploaded image"}
                          className="max-h-[180px] object-contain mx-auto"
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                      Upload en ny fil herunder for at erstatte den eksisterende
                    </p>
                    <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragOver
                        ? "border-primary bg-primary/10"
                        : "border-border/50 bg-background/50"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    data-testid="upload-dropzone"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={acceptTypes}
                      onChange={handleFileInputChange}
                      className="hidden"
                      multiple
                      data-testid="input-file"
                    />

                    <div className="space-y-3">
                      <Upload className="w-10 h-10 mx-auto text-muted-foreground/50" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {newType === "image"
                            ? "Drop images here"
                            : "Drop files here"}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          or{" "}
                          <button
                            className="text-primary underline cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                            type="button"
                          >
                            browse
                          </button>{" "}
                          to upload (multiple files supported)
                        </p>
                        <p className="text-xs text-muted-foreground/50 mt-2">
                          {newType === "image"
                            ? "PNG, JPG, JPEG, WebP"
                            : "PDF, DOCX, TXT, MD, CSV, JSON"}
                        </p>
                      </div>
                    </div>
                  </div>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragOver
                        ? "border-primary bg-primary/10"
                        : "border-border/50 bg-background/50"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    data-testid="upload-dropzone"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={acceptTypes}
                      onChange={handleFileInputChange}
                      className="hidden"
                      multiple
                      data-testid="input-file"
                    />
                    <div className="space-y-3">
                      <Upload className="w-10 h-10 mx-auto text-muted-foreground/50" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {newType === "image" ? "Drop images here" : "Drop files here"}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          or{" "}
                          <button
                            className="text-primary underline cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                            type="button"
                          >
                            browse
                          </button>{" "}
                          to upload (multiple files supported)
                        </p>
                        <p className="text-xs text-muted-foreground/50 mt-2">
                          {newType === "image"
                            ? "PNG, JPG, JPEG, WebP"
                            : "PDF, DOCX, TXT, MD, CSV, JSON"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {pendingUploads.length > 0 && (
                  <div className="space-y-2">
                    {pendingUploads.map((upload) => (
                      <div
                        key={upload.id}
                        className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-background/50 border border-border/30"
                      >
                        {upload.status === "uploading" && (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                            <span className="text-muted-foreground flex-1 truncate">
                              Uploading {upload.file.name}...
                            </span>
                          </>
                        )}
                        {upload.status === "saving" && (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                            <span className="text-muted-foreground flex-1 truncate">
                              Saving {upload.file.name}...
                            </span>
                          </>
                        )}
                        {upload.status === "error" && (
                          <>
                            <X className="w-3.5 h-3.5 text-destructive" />
                            <span className="text-destructive flex-1 truncate">
                              {upload.file.name}: {upload.error}
                            </span>
                            <button
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => dismissUploadError(upload.id)}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingItem(null);
                      setPendingUploads([]);
                    }}
                    disabled={addItem.isPending || pendingUploads.some((u) => u.status === "uploading" || u.status === "saving")}
                    data-testid="button-cancel-context"
                  >
                    Cancel
                  </Button>
                  {isTextType(newType) && (
                    <Button
                      onClick={handleAdd}
                      disabled={!newContent.trim() || addItem.isPending}
                      data-testid="button-save-context"
                    >
                      {addItem.isPending ? "Saving..." : "Save"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : items?.length === 0 && !isAdding ? (
            <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No context items yet.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Add notes, files, images, and requirements to build context for your session.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items?.map((item: ContextItem) => (
                <Card
                  key={item.id}
                  className="group border-border/50 hover:border-border transition-colors bg-card/40"
                  data-testid={`card-context-${item.id}`}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon type={item.type} />
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {item.type}
                        </span>
                        {item.label && (
                          <>
                            <span className="text-muted-foreground text-xs">
                              &bull;
                            </span>
                            <span className="text-sm font-medium text-foreground">
                              {item.label}
                            </span>
                          </>
                        )}
                        {item.filename && (
                          <span className="text-xs text-muted-foreground/60 ml-1 font-mono">
                            {item.filename}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-context-${item.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleteItem.isPending}
                          data-testid={`button-delete-context-${item.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {item.type === "image" && item.fileUrl && (
                      <>
                        <div className="rounded-md overflow-hidden bg-background/50 max-h-[200px]">
                          <img
                            src={`/api/storage${item.fileUrl}`}
                            alt={item.filename || "uploaded image"}
                            className="max-h-[200px] object-contain mx-auto"
                          />
                        </div>
                        {imageAnalyses[item.id] && (
                          <ImageAnalysisPanel
                            itemId={item.id}
                            analysis={imageAnalyses[item.id]}
                            onAnswerChange={(index, value) =>
                              handleAnswerChange(item.id, index, value)
                            }
                            onSaveAnswers={() => handleSaveAnswers(item)}
                            saving={!!savingAnswers[item.id]}
                          />
                        )}
                      </>
                    )}

                    {item.type === "file" && item.fileUrl && (
                      <div className="bg-background/50 rounded-md p-3 flex items-center gap-2">
                        <FileIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.filename || "Uploaded file"}
                        </span>
                        {item.mimeType && (
                          <span className="text-xs text-muted-foreground/50">
                            ({item.mimeType})
                          </span>
                        )}
                      </div>
                    )}

                    {!(item.type === "image" && item.fileUrl) &&
                      !(item.type === "file" && item.fileUrl && !item.content) && item.content && (
                      <div className="bg-background/50 rounded-md p-3 max-h-[200px] overflow-y-auto">
                        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap font-sans">
                          {item.content}
                        </pre>
                      </div>
                    )}
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
