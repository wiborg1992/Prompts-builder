import { useState } from "react";
import {
  useAddContextItem,
  getListContextItemsQueryKey,
  getGetSessionSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, ChevronLeft, Sparkles, Check } from "lucide-react";

const OUTPUT_TYPES = [
  { id: "user-journey", label: "User Journey Map" },
  { id: "workflow", label: "Workflow / Process" },
  { id: "wireframe", label: "Wireframes / UI" },
  { id: "service-blueprint", label: "Service Blueprint" },
  { id: "concept", label: "Konceptideation" },
  { id: "system-map", label: "System Map" },
  { id: "research", label: "Research Synthesis" },
  { id: "other", label: "Andet" },
];

const PHASES = [
  { id: "discovery", label: "Discovery" },
  { id: "definition", label: "Definition" },
  { id: "ideation", label: "Ideation" },
  { id: "prototyping", label: "Prototyping" },
  { id: "testing", label: "Testing" },
  { id: "implementation", label: "Implementation" },
];

interface BriefState {
  outputTypes: string[];
  targetAudience: string;
  projectContext: string;
  phase: string;
  constraints: string;
}

const STEPS = ["output", "audience", "project", "phase", "constraints"] as const;
type Step = (typeof STEPS)[number];

function ToggleChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i === current
              ? "w-4 h-1.5 bg-primary"
              : i < current
              ? "w-1.5 h-1.5 bg-primary/50"
              : "w-1.5 h-1.5 bg-border"
          }`}
        />
      ))}
    </div>
  );
}

export function SessionBriefWizard({
  sessionId,
  onComplete,
  onSkip,
}: {
  sessionId: number;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [step, setStep] = useState<number>(0);
  const [brief, setBrief] = useState<BriefState>({
    outputTypes: [],
    targetAudience: "",
    projectContext: "",
    phase: "",
    constraints: "",
  });
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const addItem = useAddContextItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContextItemsQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getGetSessionSummaryQueryKey(sessionId) });
      },
    },
  });

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const canProceed = () => {
    if (currentStep === "output") return brief.outputTypes.length > 0;
    if (currentStep === "audience") return brief.targetAudience.trim().length > 0;
    if (currentStep === "project") return brief.projectContext.trim().length > 0;
    if (currentStep === "phase") return brief.phase.length > 0;
    return true;
  };

  const toggleOutputType = (id: string) => {
    setBrief((prev) => ({
      ...prev,
      outputTypes: prev.outputTypes.includes(id)
        ? prev.outputTypes.filter((t) => t !== id)
        : [...prev.outputTypes, id],
    }));
  };

  const handleNext = () => {
    if (!isLastStep) {
      setStep((s) => s + 1);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const items: { label: string; content: string }[] = [];

    if (brief.outputTypes.length > 0) {
      const labels = brief.outputTypes
        .map((id) => OUTPUT_TYPES.find((t) => t.id === id)?.label ?? id)
        .join(", ");
      items.push({
        label: "Ønsket outputtype",
        content: `Sessionens formål er at producere: ${labels}`,
      });
    }

    if (brief.phase) {
      const phaseLabel = PHASES.find((p) => p.id === brief.phase)?.label ?? brief.phase;
      items.push({
        label: "Designfase",
        content: `Vi befinder os i: ${phaseLabel}-fasen`,
      });
    }

    if (brief.targetAudience.trim()) {
      items.push({
        label: "Målgruppe / Brugere",
        content: brief.targetAudience.trim(),
      });
    }

    if (brief.projectContext.trim()) {
      items.push({
        label: "Projektkontekst",
        content: brief.projectContext.trim(),
      });
    }

    if (brief.constraints.trim()) {
      items.push({
        label: "Begrænsninger og krav",
        content: brief.constraints.trim(),
      });
    }

    for (const item of items) {
      await addItem.mutateAsync({
        sessionId,
        data: {
          type: "requirement",
          label: item.label,
          content: item.content,
        },
      });
    }

    setSaving(false);
    onComplete();
  };

  const stepTitles: Record<Step, string> = {
    output: "Hvad skal vi skabe?",
    audience: "Hvem er brugerne?",
    project: "Hvad handler projektet om?",
    phase: "Hvilken fase er I i?",
    constraints: "Særlige krav eller begrænsninger?",
  };

  const stepDescriptions: Record<Step, string> = {
    output: "Vælg hvilken type designoutput sessionen skal munde ud i.",
    audience: "Beskriv hvem designet er til — brugere, kunder, interne roller.",
    project: "Giv en kort beskrivelse af produkt, service eller system I arbejder på.",
    phase: "Designfasen hjælper systemet at vælge den rigtige tilgang.",
    constraints:
      "Tekniske, brand- eller forretningsmæssige begrænsninger. Kan springes over.",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[500px] mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6 pb-4 border-b border-border/50 bg-card/50">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono uppercase tracking-wider text-primary">
              Session Brief
            </span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{stepTitles[currentStep]}</h2>
          <p className="text-sm text-muted-foreground mt-1">{stepDescriptions[currentStep]}</p>
        </div>

        <div className="p-6 min-h-[200px]">
          {currentStep === "output" && (
            <div className="flex flex-wrap gap-2">
              {OUTPUT_TYPES.map((type) => (
                <ToggleChip
                  key={type.id}
                  label={type.label}
                  selected={brief.outputTypes.includes(type.id)}
                  onClick={() => toggleOutputType(type.id)}
                />
              ))}
            </div>
          )}

          {currentStep === "audience" && (
            <Textarea
              autoFocus
              placeholder="F.eks. 'Travle sygeplejersker på mobil enhed' eller 'B2B-kunder der onboardes første gang'"
              className="min-h-[120px] resize-none bg-background"
              value={brief.targetAudience}
              onChange={(e) => setBrief((b) => ({ ...b, targetAudience: e.target.value }))}
            />
          )}

          {currentStep === "project" && (
            <Textarea
              autoFocus
              placeholder="F.eks. 'En digital platform der forbinder patienter med deres læger via video og chat'"
              className="min-h-[120px] resize-none bg-background"
              value={brief.projectContext}
              onChange={(e) => setBrief((b) => ({ ...b, projectContext: e.target.value }))}
            />
          )}

          {currentStep === "phase" && (
            <div className="flex flex-wrap gap-2">
              {PHASES.map((phase) => (
                <ToggleChip
                  key={phase.id}
                  label={phase.label}
                  selected={brief.phase === phase.id}
                  onClick={() => setBrief((b) => ({ ...b, phase: phase.id }))}
                />
              ))}
            </div>
          )}

          {currentStep === "constraints" && (
            <Textarea
              autoFocus
              placeholder="F.eks. 'Skal følge DS brand guidelines', 'Kun native iOS', 'WCAG AA krav'. Valgfrit — lad stå tom for at springe over."
              className="min-h-[120px] resize-none bg-background"
              value={brief.constraints}
              onChange={(e) => setBrief((b) => ({ ...b, constraints: e.target.value }))}
            />
          )}
        </div>

        <div className="px-6 py-4 flex items-center justify-between border-t border-border/50 bg-card/20">
          <div className="flex items-center gap-4">
            <StepDots current={step} total={STEPS.length} />
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Spring over
            </button>
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Tilbage
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canProceed() || saving}
              className="gap-1.5"
            >
              {saving ? (
                "Gemmer..."
              ) : isLastStep ? (
                <>
                  <Check className="w-4 h-4" />
                  Gem brief
                </>
              ) : (
                <>
                  Næste
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
