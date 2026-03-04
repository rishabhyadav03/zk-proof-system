export default function NullifierBadge({ nullifier }) {
  if (!nullifier) return null;

  const short = nullifier.toString().slice(0, 16) + "..." + nullifier.toString().slice(-8);

  return (
    <div className="mt-4 bg-zinc-900 border border-green-900 rounded-lg p-3">
      <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-1">
        Nullifier (public · stored on-chain)
      </p>
      <p className="text-green-400 text-xs font-mono break-all">{short}</p>
      <p className="text-zinc-600 text-xs font-mono mt-1">
        Poseidon hash · prevents double-use · does not reveal identity
      </p>
    </div>
  );
}
