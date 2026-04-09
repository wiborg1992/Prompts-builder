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
  MessageSquare,
  Plus,
  FileQuestion,
  Type,
  Upload,
  Loader2,
  File as FileIcon,
  X,
} from "lucide-react";

const TypeIcon = ({ type }: { type: ContextItemType }) => {
  switch (type) {
    case "transcript":
      return <MessageSquare className="w-4 h-4 text-blue-400" />;
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

const textTypes: ContextItemType[] = ["note", "paste", "requirement", "transcript"];
const uploadTypes: ContextItemType[] = ["file", "image"];

function isTextType(type: ContextItemType): boolean {
  return textTypes.includes(type);
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
  const [newType, setNewType] = useState<ContextItemType>("note");
  const [newLabel, setNewLabel] = useState("");
  const [newContent, setNewContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      addItem.mutate({
        sessionId,
        data: {
          type: newType,
          label: newLabel.trim() || uploadedFileName || undefined,
          content: uploadedFileName || "Uploaded file",
          fileUrl: response.objectPath,
          filename: uploadedFileName,
          mimeType: uploadedMimeType,
        },
      });
    },
    onError: (err) => {
      setUploadError(err.message);
    },
  });

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedMimeType, setUploadedMimeType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const addItem = useAddContextItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContextItemsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
        setIsAdding(false);
        setNewLabel("");
        setNewContent("");
        setNewType("note");
        setUploadedFileName(null);
        setUploadedMimeType(null);
        setUploadError(null);
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
    addItem.mutate({
      sessionId,
      data: {
        type: newType,
        label: newLabel.trim() || undefined,
        content: newContent,
      },
    });
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate({ sessionId, id });
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploadedFileName(file.name);
      setUploadedMimeType(file.type);
      await uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
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
                  <div className="flex-1">
                    <Input
                      placeholder="Label (Optional)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      data-testid="input-context-label"
                    />
                  </div>
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
                      data-testid="input-file"
                    />

                    {isUploading ? (
                      <div className="space-y-2">
                        <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">
                          Uploading {uploadedFileName}... {progress}%
                        </p>
                      </div>
                    ) : uploadedFileName && !uploadError ? (
                      <div className="space-y-2">
                        <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">
                          Saving {uploadedFileName}...
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="w-10 h-10 mx-auto text-muted-foreground/50" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {newType === "image"
                              ? "Drop an image here"
                              : "Drop a file here"}
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
                            to upload
                          </p>
                          <p className="text-xs text-muted-foreground/50 mt-2">
                            {newType === "image"
                              ? "PNG, JPG, JPEG, WebP"
                              : "PDF, DOCX, TXT, MD, CSV, JSON"}
                          </p>
                        </div>
                      </div>
                    )}

                    {uploadError && (
                      <p className="text-xs text-destructive mt-2">{uploadError}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsAdding(false);
                      setUploadError(null);
                      setUploadedFileName(null);
                    }}
                    disabled={addItem.isPending || isUploading}
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
                Record a session or add notes, files, and requirements.
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

                    {item.type === "image" && item.fileUrl && (
                      <div className="rounded-md overflow-hidden bg-background/50 max-h-[200px]">
                        <img
                          src={`/api/storage${item.fileUrl}`}
                          alt={item.filename || "uploaded image"}
                          className="max-h-[200px] object-contain mx-auto"
                        />
                      </div>
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
