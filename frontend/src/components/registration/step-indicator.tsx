import { Check } from "lucide-react";

interface Step {
  number: number;
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center min-w-max gap-1">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                step.number < currentStep
                  ? "bg-[#3b82f6] text-white"
                  : step.number === currentStep
                    ? "bg-[#3b82f6] text-white"
                    : "bg-[#e5e7eb] text-[#9ca3af]"
              }`}
            >
              {step.number < currentStep ? (
                <Check className="w-4 h-4" />
              ) : (
                step.number
              )}
            </div>
            <span
              className={`text-sm font-medium whitespace-nowrap ${
                step.number === currentStep
                  ? "text-[#3b82f6]"
                  : step.number < currentStep
                    ? "text-foreground"
                    : "text-muted-foreground"
              }`}
            >
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-6 h-[2px] shrink-0 mx-1 ${
                step.number < currentStep ? "bg-[#3b82f6]" : "bg-[#e5e7eb]"
              }`}
            />
          )}
        </div>
        ))}
      </div>
    </div>
  );
}
