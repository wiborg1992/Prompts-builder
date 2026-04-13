import { useState } from "react";
import {
  useGeneratePrompt,
  useClarifyPrompt,
  getListPromptsQueryKey,
  getGetSessionSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, HelpCircle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PanelState = "idle" | "checking" | "clarifying" | "generating";

interface Props {
  sessionId: number;
  onSuccess: (promptId: number) => void;
}

export function GenerateBar({ sessionId, onSuccess }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [instruction, setInstruction] = useState("");
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

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
      },
    },
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
        onSuccess(newPrompt.id);

        const stored = typeof window !== "undefined"
          ? window.localStorage.getItem("prompt-studio-auto-download")
          : null;
        const autoDownload = stored ? stored === "true" : true;
        if (autoDownload) {
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
      },
    },
  });

  const doGenerate = (clarifications: Array<{ question: string; answer: string }>) => {
    setPanelState("generating");
    generatePrompt.mutate({
      sessionId,
      data: {
        instruction: instruction.trim() || undefined,
        clarifications: clarifications.length > 0 ? clarifications : undefined,
      },
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
      data: { instruction: instruction.trim() || undefined },
    });
  };

  const isWorking = panelState === "checking" || panelState === "generating";

  return (
    <div className="flex-none border-t border-border bg-background">
      {panelState === "clarifying" && (
        <div className="px-4 pt-4 pb-0 border-b border-border/50 bg-primary/5">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary mb-0.5">Afklarende spørgsmål</p>
                <p className="text-xs text-muted-foreground">
                  Besvar dem for et mere præcist resultat — eller spring over.
                </p>
              </div>
            </div>
            <div className="space-y-3 pb-4">
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
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleGenerate}
                  disabled={isWorking}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
                  data-testid="button-generate-prompt"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Generer
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => doGenerate([])}
                  disabled={isWorking}
                  className="text-muted-foreground text-sm"
                >
                  Spring over
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            placeholder="Valgfri instruktion (f.eks. 'Fokuser på tilgængelighed')"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            className="flex-1"
            data-testid="input-prompt-instruction"
            disabled={isWorking}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && panelState === "idle") {
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
            ) : (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Generer
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
