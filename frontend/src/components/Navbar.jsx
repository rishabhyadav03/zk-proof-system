import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Navbar({ activePage, setActivePage }) {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">

        {/* Logo */}
        <div>
          <span className="text-green-400 font-bold text-lg tracking-widest font-mono">
            ZK
          </span>
          <span className="text-zinc-100 font-bold text-lg tracking-widest font-mono">
            CREDENTIAL
          </span>
          <p className="text-zinc-500 text-xs font-mono mt-0.5">
            Anonymous Proof System · Solana Devnet
          </p>
        </div>

        {/* Tabs + Wallet */}
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded p-1 gap-1">
            <button
              onClick={() => setActivePage("age")}
              className={`px-4 py-1.5 text-xs font-mono rounded transition-all ${
                activePage === "age"
                  ? "bg-green-500 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              AGE PROOF
            </button>
            <button
              onClick={() => setActivePage("vote")}
              className={`px-4 py-1.5 text-xs font-mono rounded transition-all ${
                activePage === "vote"
                  ? "bg-green-500 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              VOTE PROOF
            </button>
          </div>
          <WalletMultiButton style={{ fontSize: "12px", height: "36px" }} />
        </div>

      </div>
    </nav>
  );
}
