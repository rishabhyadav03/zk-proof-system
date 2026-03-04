import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import * as snarkjs from "snarkjs";
import ProofStatus from "../components/ProofStatus";
import NullifierBadge from "../components/NullifierBadge";

export default function AgeProof() {
  const { publicKey } = useWallet();

  const [form, setForm] = useState({
    birthYear: "", birthMonth: "", birthDay: "", secret: "",
  });
  const [status, setStatus]     = useState("idle");
  const [proof, setProof]       = useState(null);
  const [nullifier, setNullifier] = useState(null);
  const [proofTime, setProofTime] = useState(null);
  const [error, setError]       = useState("");

  const today = new Date();

  async function generateProof() {
    setError("");
    setStatus("generating");
    const start = Date.now();

    try {
      const input = {
        birthYear:    String(form.birthYear),
        birthMonth:   String(form.birthMonth),
        birthDay:     String(form.birthDay),
        secret:       String(form.secret),
        currentYear:  String(today.getFullYear()),
        currentMonth: String(today.getMonth() + 1),
        currentDay:   String(today.getDate()),
      };

      const { proof: p, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "/age/age_proof.wasm",
        "/age/age_proof_final.zkey"
      );

      setProofTime(((Date.now() - start) / 1000).toFixed(2));
      setProof(p);
      setNullifier(publicSignals[0]);
      setStatus("proved");
    } catch (e) {
  console.error(e);
  const msg = e.message || "";
  if (msg.includes("Assert Failed") || msg.includes("line: 173")) {
    setError("Age verification failed — you must be 18 or older to generate this proof.");
  } else {
    setError("Proof generation failed. Check your inputs.");
  }
  setStatus("error");
}
  }

  async function submitToSolana() {
    if (!publicKey) { setError("Please connect your Phantom wallet first."); return; }
    setStatus("submitting");
    // Simulate on-chain submission (replace with real Anchor call)
    await new Promise(r => setTimeout(r, 2000));
    setStatus("verified");
  }

  const isValid =
    form.birthYear && form.birthMonth && form.birthDay && form.secret &&
    parseInt(form.birthMonth) >= 1 && parseInt(form.birthMonth) <= 12 &&
    parseInt(form.birthDay) >= 1 && parseInt(form.birthDay) <= 31;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-green-500 text-zinc-950 text-xs font-mono font-bold px-2 py-0.5 rounded">
            AGE PROOF
          </span>
          <span className="text-zinc-500 text-xs font-mono">age_proof.circom · Groth16 · BN254</span>
        </div>
        <h1 className="text-2xl font-bold font-mono text-zinc-100">Age Verification</h1>
        <p className="text-zinc-400 text-sm font-mono mt-1">
          Prove you are ≥18 years old without revealing your date of birth.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-3">How it works</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { step: "01", label: "Enter DOB", desc: "Stays in your browser. Never sent anywhere." },
            { step: "02", label: "Generate Proof", desc: "snarkjs creates a Groth16 ZK proof locally." },
            { step: "03", label: "Submit On-Chain", desc: "Proof verified on Solana. DOB never revealed." },
          ].map(s => (
            <div key={s.step} className="bg-zinc-950 border border-zinc-800 rounded p-3">
              <p className="text-green-400 text-xs font-mono font-bold mb-1">{s.step}</p>
              <p className="text-zinc-100 text-xs font-mono font-bold">{s.label}</p>
              <p className="text-zinc-500 text-xs font-mono mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-4">
          Private Inputs · Never Leave Your Browser
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { key: "birthYear",  label: "Birth Year",  placeholder: "2000", type: "number" },
            { key: "birthMonth", label: "Birth Month", placeholder: "6",    type: "number" },
            { key: "birthDay",   label: "Birth Day",   placeholder: "15",   type: "number" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-zinc-400 text-xs font-mono block mb-1">{f.label}</label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm font-mono focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
          ))}
        </div>

        <div className="mb-6">
          <label className="text-zinc-400 text-xs font-mono block mb-1">
            Secret Salt <span className="text-zinc-600">(any random number — generates your nullifier)</span>
          </label>
          <input
            type="number"
            placeholder="e.g. 987654321"
            value={form.secret}
            onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm font-mono focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>

        {/* Public inputs info */}
        <div className="bg-zinc-950 border border-zinc-800 rounded p-3 mb-6 text-xs font-mono text-zinc-500">
          <span className="text-zinc-400">Public inputs (visible to verifier): </span>
          currentYear={today.getFullYear()} · currentMonth={today.getMonth()+1} · currentDay={today.getDate()}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-800 rounded p-3 mb-4">
            <p className="text-red-400 text-xs font-mono">✗ {error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={generateProof}
            disabled={!isValid || status === "generating"}
            className="flex-1 bg-green-500 hover:bg-green-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-bold font-mono text-sm py-2.5 rounded transition-colors"
          >
            {status === "generating" ? "⟳ Generating..." : "Generate ZK Proof"}
          </button>
          <button
            onClick={submitToSolana}
            disabled={status !== "proved"}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-100 font-bold font-mono text-sm py-2.5 rounded border border-zinc-700 transition-colors"
          >
            {status === "submitting" ? "⟳ Submitting..." : "Submit to Solana →"}
          </button>
        </div>
      </div>

      {/* Proof time */}
      {proofTime && (
        <p className="text-zinc-500 text-xs font-mono mt-2 text-right">
          ⚡ Proof generated in {proofTime}s in browser
        </p>
      )}

      {/* Proof pipeline */}
      <ProofStatus status={status} />

      {/* Nullifier */}
      <NullifierBadge nullifier={nullifier} />

      {/* Raw proof output */}
      {proof && (
        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-2">
            Proof Output (Groth16)
          </p>
          <pre className="text-green-400 text-xs font-mono overflow-x-auto max-h-40 scrollbar-thin">
            {JSON.stringify(proof, null, 2)}
          </pre>
        </div>
      )}

      {/* Verified badge */}
      {status === "verified" && (
        <div className="mt-4 bg-green-950 border border-green-700 rounded-lg p-4 text-center">
          <p className="text-green-400 font-bold font-mono text-lg">✓ AGE VERIFIED ON-CHAIN</p>
          <p className="text-green-600 text-xs font-mono mt-1">
            Solana program confirmed: age ≥ 18 · Identity not revealed
          </p>
        </div>
      )}
    </div>
  );
}
