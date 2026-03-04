// generate_vote_input.js
// Run: node generate_vote_input.js
// This computes the correct Merkle root and path for vote_input.json

const { buildPoseidon } = require("circomlibjs");

async function main() {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    // ── Config ────────────────────────────────────────────────
    const TREE_DEPTH = 10;
    const VOTER_SECRET = BigInt("12345678901234567");
    const VOTE = "1";
    const ELECTION_ID = "1";
    const CANDIDATE_COUNT = "3";
    const VOTER_INDEX = 0; // voter is at index 0 in the tree
    // ─────────────────────────────────────────────────────────

    // Zero value for empty leaves
    const ZERO = BigInt(0);

    // Helper: poseidon hash of 1 input
    function hash1(a) {
        return F.toObject(poseidon([a]));
    }

    // Helper: poseidon hash of 2 inputs
    function hash2(a, b) {
        return F.toObject(poseidon([a, b]));
    }

    // Step 1: Compute voter commitment = Poseidon(voterSecret)
    const commitment = hash1(VOTER_SECRET);
    console.log("Voter commitment:", commitment.toString());

    // Step 2: Build Merkle tree
    // We have 4 registered voters, rest are zero leaves
    // voter 0 = our voter (commitment), voters 1,2,3 = dummy commitments
    const numLeaves = Math.pow(2, TREE_DEPTH);
    
    // Build leaf layer
    let currentLayer = [];
    for (let i = 0; i < numLeaves; i++) {
        if (i === 0) {
            currentLayer.push(commitment); // our voter
        } else if (i === 1) {
            currentLayer.push(hash1(BigInt("99999999999")));  // dummy voter 1
        } else if (i === 2) {
            currentLayer.push(hash1(BigInt("88888888888")));  // dummy voter 2
        } else if (i === 3) {
            currentLayer.push(hash1(BigInt("77777777777")));  // dummy voter 3
        } else {
            currentLayer.push(ZERO); // empty leaf
        }
    }

    // Build all layers up to root
    const layers = [currentLayer];
    let layer = currentLayer;
    for (let level = 0; level < TREE_DEPTH; level++) {
        const nextLayer = [];
        for (let i = 0; i < layer.length; i += 2) {
            nextLayer.push(hash2(layer[i], layer[i + 1]));
        }
        layers.push(nextLayer);
        layer = nextLayer;
    }

    const merkleRoot = layers[TREE_DEPTH][0];
    console.log("Merkle Root:", merkleRoot.toString());

    // Step 3: Compute path for voter at VOTER_INDEX
    const pathElements = [];
    const pathIndices = [];
    let index = VOTER_INDEX;

    for (let level = 0; level < TREE_DEPTH; level++) {
        const isRight = index % 2; // 1 if right child, 0 if left child
        const siblingIndex = isRight ? index - 1 : index + 1;
        pathIndices.push(isRight.toString());
        pathElements.push(layers[level][siblingIndex].toString());
        index = Math.floor(index / 2);
    }

    console.log("Path Elements:", pathElements);
    console.log("Path Indices:", pathIndices);

    // Step 4: Compute nullifier = Poseidon(voterSecret, electionID)
    const nullifier = hash2(VOTER_SECRET, BigInt(ELECTION_ID));
    console.log("Nullifier:", nullifier.toString());

    // Step 5: Write vote_input.json
    const input = {
        voterSecret:      VOTER_SECRET.toString(),
        vote:             VOTE,
        pathElements:     pathElements,
        pathIndices:      pathIndices,
        merkleRoot:       merkleRoot.toString(),
        electionID:       ELECTION_ID,
        candidateCount:   CANDIDATE_COUNT
    };

    const fs = require("fs");
    fs.writeFileSync(
        "../inputs/vote_input.json",
        JSON.stringify(input, null, 2)
    );

    console.log("\n✅ vote_input.json written successfully!");
    console.log("📁 Location: inputs/vote_input.json");
    console.log("\nPublic signals that verifier will see:");
    console.log("  nullifier:      ", nullifier.toString());
    console.log("  merkleRoot:     ", merkleRoot.toString());
    console.log("  electionID:     ", ELECTION_ID);
    console.log("  candidateCount: ", CANDIDATE_COUNT);
    console.log("\nPrivate inputs (NEVER revealed):");
    console.log("  voterSecret:    ", VOTER_SECRET.toString());
    console.log("  vote:           ", VOTE, "(candidate index)");
}

main().catch(console.error);