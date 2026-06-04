"use client";

export function Stepper({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div className="stepper">
      {steps.map((label, i) => {
        const cls = i < active ? "stepper-step done" : i === active ? "stepper-step active" : "stepper-step";
        return (
          <div key={label} className={cls}>
            <span className="stepper-track" />
            <span className="stepper-label">
              {i + 1}. {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
