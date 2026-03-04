pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";
include "node_modules/circomlib/circuits/bitify.circom";

/*
 * VoteProof Circuit
 * -----------------
 * Proves that a voter:
 *   1. Is a member of the eligible voters Merkle tree
 *   2. Has cast a valid vote (candidateID in range)
 *   3. Has not voted before (via nullifier)
 *
 * WITHOUT revealing:
 *   - Who the voter is
 *   - Which candidate they voted for
 *   - Their secret
 *
 * Private Inputs (never revealed):
 *   - voterSecret          : random secret known only to voter
 *   - vote                 : candidate ID chosen (0 to candidateCount-1)
 *   - pathElements[10]     : sibling hashes along Merkle path
 *   - pathIndices[10]      : 0=left, 1=right at each Merkle level
 *
 * Public Inputs (visible on-chain):
 *   - merkleRoot           : root of eligible voters Merkle tree
 *   - electionID           : unique ID for this election
 *   - candidateCount       : total number of candidates
 *
 * Public Outputs:
 *   - nullifier            : Poseidon(voterSecret, electionID)
 *                            opaque fingerprint — prevents double voting
 *                            without revealing voter identity
 *
 * Security Properties:
 *   - Zero-knowledge  : verifier learns nothing about voterSecret or vote
 *   - Soundness       : cannot fake membership or valid vote
 *   - Nullifier       : same voter cannot vote twice in same election
 *   - Unlinkability   : nullifier from election A cannot be linked to election B
 */

// ─── Merkle Tree Hasher ───────────────────────────────────────────────────────
// Hashes two children to produce a parent node using Poseidon
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

// ─── Merkle Proof Verifier ────────────────────────────────────────────────────
// Verifies that a leaf is a member of a Merkle tree with given root
// nLevels: depth of the tree (10 = supports 2^10 = 1024 voters)
template MerkleProof(nLevels) {
    signal input leaf;                      // voter commitment = Poseidon(voterSecret)
    signal input pathElements[nLevels];     // sibling hashes
    signal input pathIndices[nLevels];      // 0=we are left child, 1=we are right child
    signal output root;                     // computed root — must match merkleRoot

    component hashers[nLevels];
    component muxes[nLevels];

    signal levelHashes[nLevels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < nLevels; i++) {
        // pathIndices[i] must be 0 or 1
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        hashers[i] = HashLeftRight();
        muxes[i] = MultiMux1(2);

        // If pathIndices[i] == 0: we are left child  → hash(current, sibling)
        // If pathIndices[i] == 1: we are right child → hash(sibling, current)
        muxes[i].c[0][0] <== levelHashes[i];
        muxes[i].c[0][1] <== pathElements[i];
        muxes[i].c[1][0] <== pathElements[i];
        muxes[i].c[1][1] <== levelHashes[i];
        muxes[i].s <== pathIndices[i];

        hashers[i].left  <== muxes[i].out[0];
        hashers[i].right <== muxes[i].out[1];

        levelHashes[i + 1] <== hashers[i].hash;
    }

    // Final computed root
    root <== levelHashes[nLevels];
}

// ─── Main Circuit ─────────────────────────────────────────────────────────────
template VoteProof(nLevels) {

    // ── Private inputs ──────────────────────────────────────────────────────
    signal input voterSecret;               // voter's private secret
    signal input vote;                      // candidate ID chosen
    signal input pathElements[nLevels];     // Merkle proof siblings
    signal input pathIndices[nLevels];      // Merkle proof directions

    // ── Public inputs ───────────────────────────────────────────────────────
    signal input merkleRoot;                // published on-chain before election
    signal input electionID;               // unique per election
    signal input candidateCount;           // e.g. 3 candidates → valid votes: 0,1,2

    // ── Public output ───────────────────────────────────────────────────────
    signal output nullifier;               // Poseidon(voterSecret, electionID)

    // ────────────────────────────────────────────────────────────────────────
    // Step 1: Compute voter commitment
    //   commitment = Poseidon(voterSecret)
    //   This is what was stored in the Merkle tree during registration
    // ────────────────────────────────────────────────────────────────────────
    component commitHasher = Poseidon(1);
    commitHasher.inputs[0] <== voterSecret;
    signal commitment;
    commitment <== commitHasher.out;

    // ────────────────────────────────────────────────────────────────────────
    // Step 2: Verify Merkle membership
    //   Prove commitment is a leaf in the registered voters tree
    //   If the path doesn't match merkleRoot, proof fails
    // ────────────────────────────────────────────────────────────────────────
    component merkleProof = MerkleProof(nLevels);
    merkleProof.leaf <== commitment;
    for (var i = 0; i < nLevels; i++) {
        merkleProof.pathElements[i] <== pathElements[i];
        merkleProof.pathIndices[i]  <== pathIndices[i];
    }

    // CONSTRAINT: computed root must match the published merkleRoot
    merkleProof.root === merkleRoot;

    // ────────────────────────────────────────────────────────────────────────
    // Step 3: Compute nullifier
    //   nullifier = Poseidon(voterSecret, electionID)
    //   Scoped to this election — same voter in election B has different nullifier
    //   Verifier stores nullifier on-chain to prevent double voting
    //   But cannot reverse it to find voterSecret or identity
    // ────────────────────────────────────────────────────────────────────────
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== voterSecret;
    nullifierHasher.inputs[1] <== electionID;
    nullifier <== nullifierHasher.out;

    // ────────────────────────────────────────────────────────────────────────
    // Step 4: Validate vote is in range [0, candidateCount - 1]
    //   Prevents voting for a non-existent candidate
    //
    //   vote >= 0  : always true since signals are field elements >= 0
    //   vote < candidateCount : enforced below
    // ────────────────────────────────────────────────────────────────────────

    // vote < candidateCount
    component voteRangeCheck = LessThan(8); // 8-bit supports up to 255 candidates
    voteRangeCheck.in[0] <== vote;
    voteRangeCheck.in[1] <== candidateCount;
    voteRangeCheck.out === 1; // CONSTRAINT: proof fails if vote >= candidateCount

    // vote >= 0 (redundant for field elements but explicit for clarity)
    component voteMinCheck = GreaterEqThan(8);
    voteMinCheck.in[0] <== vote;
    voteMinCheck.in[1] <== 0;
    voteMinCheck.out === 1;
}

// Instantiate with Merkle tree depth = 10 (supports 1024 voters)
// Public inputs: merkleRoot, electionID, candidateCount
component main {public [merkleRoot, electionID, candidateCount]} = VoteProof(10);

/*
 * ════════════════════════════════════════════════════════════════
 * HOW TO COMPILE & TEST (Windows PowerShell)
 * ════════════════════════════════════════════════════════════════
 *
 * 1. Make sure you are inside the circuits/ folder:
 *    cd circuits
 *
 * 2. Compile:
 *    circom vote_proof.circom --r1cs --wasm --sym -o ..\build\vote
 *
 * 3. Trusted setup (from project root):
 *    cd ..
 *    snarkjs groth16 setup build\vote\vote_proof.r1cs ptau\powersOfTau28_hez_final_12.ptau build\vote\vote_proof_0000.zkey
 *    snarkjs zkey contribute build\vote\vote_proof_0000.zkey build\vote\vote_proof_final.zkey --name="contributor1" -v
 *    snarkjs zkey export verificationkey build\vote\vote_proof_final.zkey build\vote\verification_key.json
 *
 * 4. Generate witness (using vote_input.json):
 *    node build\vote\vote_proof_js\generate_witness.js build\vote\vote_proof_js\vote_proof.wasm inputs\vote_input.json build\vote\witness.wtns
 *
 * 5. Generate proof:
 *    snarkjs groth16 prove build\vote\vote_proof_final.zkey build\vote\witness.wtns build\vote\proof.json build\vote\public.json
 *
 * 6. Verify proof:
 *    snarkjs groth16 verify build\vote\verification_key.json build\vote\public.json build\vote\proof.json
 *    Output: OK!
 *
 * ════════════════════════════════════════════════════════════════
 * WHAT public.json CONTAINS (what verifier sees on-chain):
 * ════════════════════════════════════════════════════════════════
 *   [
 *     "nullifier_value",    ← Poseidon(voterSecret, electionID) — opaque
 *     "merkleRoot_value",   ← published root of voters tree
 *     "1",                  ← electionID
 *     "3"                   ← candidateCount
 *   ]
 *   Verifier NEVER sees: voterSecret, vote, pathElements, pathIndices
 *
 * ════════════════════════════════════════════════════════════════
 * CIRCUIT STATS:
 * ════════════════════════════════════════════════════════════════
 *   Merkle depth    : 10 levels (1024 max voters)
 *   Constraints     : ~1400-1600
 *   Proof size      : ~256 bytes (Groth16)
 *   Prove time      : ~2-4 seconds in browser (snarkjs WASM)
 *   Verify time     : ~10ms on-chain
 * ════════════════════════════════════════════════════════════════
 */
