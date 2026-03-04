const steps = [
  { id: "circuit", label: "Circuit Loaded" },
  { id: "witness", label: "Witness Generated" },
  { id: "proof",   label: "Proof Created" },
  { id: "chain",   label: "On-Chain Verified" },
];

const stepOrder = ["idle", "generating", "proved", "submitting", "verified"];

function getStepStatus(stepIndex, status) {
  const statusToStep = {
    "idle":       -1,
    "generating":  0,
    "proved":      2,
    "submitting":  3,
    "verified":    4,
    "error":      -1,
  };
  const current = statusToStep[status] ?? -1;
  if (status === "verified") return "done";  // all steps done when verified
  if (current > stepIndex) return "done";
  if (current === stepIndex) return "active";
  return "idle";
}

export default function ProofStatus({ status }) {
  if (status === "idle") return null;

  return (
    <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-zinc-500 text-xs font-mono mb-4 uppercase tracking-widest">
        Proof Pipeline
      </p>
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const s = getStepStatus(i, status);
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              {/* Circle */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold border transition-all ${
                    s === "done"
                      ? "bg-green-500 border-green-500 text-zinc-950"
                      : s === "active"
                      ? "bg-zinc-900 border-green-400 text-green-400 animate-pulse"
                      : s === "error"
                      ? "bg-red-900 border-red-500 text-red-400"
                      : "bg-zinc-900 border-zinc-700 text-zinc-600"
                  }`}
                >
                  {s === "done" ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs font-mono text-center leading-tight ${
                    s === "done"
                      ? "text-green-400"
                      : s === "active"
                      ? "text-zinc-100"
                      : "text-zinc-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className={`h-px w-6 mt-[-16px] transition-all ${
                    s === "done" ? "bg-green-500" : "bg-zinc-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <div className="mt-4 text-center">
        {status === "generating" && (
          <p className="text-green-400 text-xs font-mono animate-pulse">
            ⟳ Generating ZK proof in browser... (2-4 seconds)
          </p>
        )}
        {status === "proved" && (
          <p className="text-green-400 text-xs font-mono">
            ✓ Proof generated. Ready to submit to Solana.
          </p>
        )}
        {status === "submitting" && (
          <p className="text-yellow-400 text-xs font-mono animate-pulse">
            ⟳ Submitting transaction to Solana devnet...
          </p>
        )}
        {status === "verified" && (
          <p className="text-green-400 text-xs font-mono font-bold">
            ✓ Proof verified on-chain! Credential accepted.
          </p>
        )}
      </div>
    </div>
  );
}
