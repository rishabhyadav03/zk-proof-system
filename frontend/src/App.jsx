import { useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";
import Navbar from "./components/Navbar";
import AgeProof from "./pages/AgeProof";
import VoteProof from "./pages/VoteProof";

const wallets = [new PhantomWalletAdapter()];
const endpoint = clusterApiUrl("devnet");

export default function App() {
  const [activePage, setActivePage] = useState("age");

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="min-h-screen bg-zinc-950 text-zinc-100">
            <Navbar activePage={activePage} setActivePage={setActivePage} />
            <main className="max-w-3xl mx-auto px-4 py-10">
              {activePage === "age" ? <AgeProof /> : <VoteProof />}
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
