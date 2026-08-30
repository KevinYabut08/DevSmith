import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Eyebrow, TerminalDots } from "./components/ui";

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    number: "01",
    title: "Create a project",
    description:
      "Start with a name and short description of what you want to build.",
  },
  {
    number: "02",
    title: "Generate a roadmap",
    description:
      "Let DevSmith turn your idea into clear milestones and actionable tasks.",
  },
  {
    number: "03",
    title: "Build with focus",
    description:
      "Track progress, complete tasks, and use the AI assistant when needed.",
  },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  function finish() {
    localStorage.setItem("devsmith-onboarding-complete", "true");
    onComplete();
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#071A1F] px-5 py-8 text-[#F4FFFC]">
      {/* Ambient forge glow, same treatment as the dashboard header */}
      <div
        className="pointer-events-none absolute -top-40 right-0 h-[420px] w-[420px] rounded-full opacity-[0.10] blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, #F2A65A 0%, #7FD8AE 55%, transparent 75%)",
        }}
      />

      <div className="relative w-full max-w-[620px]">
        <div className="mb-16 flex items-center gap-2.5 text-lg font-bold sm:mb-24">
          <span>DevSmith</span>
        </div>

        <Eyebrow>// welcome_to_devsmith</Eyebrow>

        <h1 className="m-0 mt-3 font-mono text-[clamp(38px,7vw,64px)] font-bold leading-[1.02] tracking-[-0.03em]">
          Turn ideas into
          <br />
          clear roadmaps.
        </h1>

        <p className="my-7 mb-12 max-w-[410px] leading-relaxed text-[#8FA9A8]">
          A simple workspace for planning, building, and shipping better
          software projects.
        </p>

        <div className="flex gap-6 border-y border-white/[0.08] py-7">
          <span className="font-mono text-[13px] text-[#5C8A85]">
            {currentStep.number}
          </span>

          <div>
            <h2 className="m-0 mb-2 text-[21px] font-semibold">
              {currentStep.title}
            </h2>
            <p className="m-0 leading-relaxed text-[#8FA9A8]">
              {currentStep.description}
            </p>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {steps.map((item, index) => (
                <button
                  key={item.number}
                  type="button"
                  aria-label={`Go to step ${index + 1}`}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => setStep(index)}
                  className={`h-2 w-2 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/50 ${
                    index === step ? "bg-[#7FD8AE]" : "bg-white/[0.15]"
                  }`}
                />
              ))}
            </div>
            <TerminalDots />
          </div>

          <button
            type="button"
            onClick={() => (isLastStep ? finish() : setStep(step + 1))}
            className="flex items-center gap-3 rounded-lg bg-[#F2A65A] px-[17px] py-[13px] text-sm font-semibold text-[#071A1F] outline-none transition hover:bg-[#F5B673] hover:shadow-[0_0_20px_2px_rgba(242,166,90,0.2)] focus-visible:ring-2 focus-visible:ring-[#F2A65A]/60"
          >
            {isLastStep ? "Get started" : "Continue"}
            <ArrowRight size={17} strokeWidth={2.5} />
          </button>
        </div>

        <button
          type="button"
          onClick={finish}
          className="mx-auto mt-[30px] block border-0 bg-transparent text-xs text-[#5C8A85] outline-none transition hover:text-[#F4FFFC] focus-visible:ring-2 focus-visible:ring-[#7FD8AE]/40"
        >
          Skip introduction
        </button>
      </div>
    </main>
  );
}