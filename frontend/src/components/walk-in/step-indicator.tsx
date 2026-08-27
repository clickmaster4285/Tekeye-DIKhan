const steps = [
  { number: 1, labelLines: ["Visitor", "Details"] },
  { number: 2, labelLines: ["Document", "Upload"] },
  { number: 3, labelLines: ["Visit", "Details"] },
  { number: 4, labelLines: ["QR Code Generation &", "Clearance"] },
];

const ACTIVE_BLUE = "#3366FF";

export function WalkInStepIndicator({ currentStep = 1 }) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "40px 56px",
        background: "#f8f9fa",
      }}
    >
      {/* Steps row */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          width: "100%",
          maxWidth: 800,
        }}
      >
        {/* Full-width gray connector line behind circles */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 17,
            height: 2,
            backgroundColor: "#d9d9d9",
            zIndex: 0,
          }}
        />
        {/* Blue progress line – extends to current step */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 17,
            height: 2,
            width: `${((currentStep - 0.5) / steps.length) * 100}%`,
            backgroundColor: ACTIVE_BLUE,
            zIndex: 0,
          }}
        />

        {steps.map((step) => {
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;
          const isActiveOrCompleted = isActive || isCompleted;

          return (
            <div
              key={step.number}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  backgroundColor: isActiveOrCompleted ? ACTIVE_BLUE : "#fff",
                  border: isActiveOrCompleted ? "none" : "1.5px solid #d9d9d9",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isActiveOrCompleted ? "#fff" : "#adb5bd",
                    letterSpacing: "0.01em",
                  }}
                >
                  {String(step.number).padStart(2, "0")}
                </span>
              </div>

              {/* Label – compact under circle, blue when active */}
              <div
                style={{
                  marginTop: 6,
                  textAlign: "center",
                  fontSize: 14,
                  lineHeight: 1.4,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? ACTIVE_BLUE : "#6c757d",
                }}
              >
                {step.labelLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}