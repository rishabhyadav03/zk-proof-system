# ZK Anonymous Credential System

A zero-knowledge proof system for privacy-preserving identity verification and anonymous voting on Solana.

## Projects

**1. Age Verification**
Prove you are ≥18 years old without revealing your date of birth.

**2. Anonymous Voting**
Prove you are a registered voter and cast a vote without revealing your identity or choice.

## How It Works

- User enters private data (date of birth / voter secret) in the browser
- snarkjs generates a Groth16 ZK proof locally — private data never leaves the browser
- Proof is submitted to Solana for on-chain verification
- A nullifier (Poseidon hash) prevents double use of the same credential

## Tech Stack

- **Circuits:** Circom 2.0 + circomlib
- **Proof System:** Groth16 / BN254
- **Browser Prover:** snarkjs (WebAssembly)
- **Frontend:** React + Tailwind CSS + Vite
- **Blockchain:** Solana (Devnet) + Anchor

## Running Locally

```bash
# Compile circuits
cd circuits
circom age_proof.circom --r1cs --wasm --sym -o ../build/age
circom vote_proof.circom --r1cs --wasm --sym -o ../build/vote

# Run frontend
cd frontend
npm install
npm run dev
```

Open https://zk-proof-system.vercel.app/
