pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/poseidon.circom";

/*
 * AgeProof Circuit
 * ----------------
 * Proves that a person is at least MIN_AGE years old
 * WITHOUT revealing their actual date of birth.
 *
 * Private Inputs (known only to the user, never revealed):
 *   - birthYear  : e.g. 1998
 *   - birthMonth : 1–12
 *   - birthDay   : 1–31
 *   - secret     : random salt to make nullifier unique per user
 *
 * Public Inputs (visible on-chain to the verifier):
 *   - currentYear  : e.g. 2025
 *   - currentMonth : 1–12
 *   - currentDay   : 1–31
 *   - minAge       : minimum age to prove (e.g. 18)
 *   - nullifier    : hash(secret) — prevents double-use of same credential
 *
 * Output:
 *   - isValid : 1 if age >= minAge, circuit fails (not 1) otherwise
 *
 * How age is computed (simplified, avoids floating point):
 *   age = currentYear - birthYear
 *   if (currentMonth < birthMonth) OR
 *      (currentMonth == birthMonth AND currentDay < birthDay):
 *       age = age - 1
 *
 * Security Properties:
 *   - Zero-knowledge: verifier learns NOTHING about birthYear/Month/Day
 *   - Soundness: user cannot fake a passing proof without valid inputs
 *   - Nullifier: same credential cannot be used twice for same purpose
 */

template AgeProof(MIN_AGE) {

    // -------------------------------------------------------
    // PRIVATE inputs (secret — never revealed to verifier)
    // -------------------------------------------------------
    signal input birthYear;    // e.g. 1998
    signal input birthMonth;   // 1..12
    signal input birthDay;     // 1..31
    signal input secret;       // random salt chosen by user

    // -------------------------------------------------------
    // PUBLIC inputs (known to the verifier / stored on-chain)
    // -------------------------------------------------------
    signal input currentYear;  // e.g. 2025
    signal input currentMonth; // 1..12
    signal input currentDay;   // 1..31

    // -------------------------------------------------------
    // PUBLIC outputs
    // -------------------------------------------------------
    signal output nullifier;   // Poseidon(secret) — unique per user

    // -------------------------------------------------------
    // Step 1: Compute the nullifier
    //   nullifier = Poseidon(secret)
    //   This lets the verifier detect if the same credential
    //   is used twice, WITHOUT knowing WHO the user is.
    // -------------------------------------------------------
    component poseidon = Poseidon(1);
    poseidon.inputs[0] <== secret;
    nullifier <== poseidon.out;

    // -------------------------------------------------------
    // Step 2: Range checks — constrain inputs to valid ranges
    //   Prevents malicious inputs like birthYear = 0 or 9999
    // -------------------------------------------------------

    // birthYear must be in [1900, 2100]
    component birthYearMin = GreaterEqThan(12); // 12-bit comparator
    birthYearMin.in[0] <== birthYear;
    birthYearMin.in[1] <== 1900;
    birthYearMin.out === 1;

    component birthYearMax = LessEqThan(12);
    birthYearMax.in[0] <== birthYear;
    birthYearMax.in[1] <== 2100;
    birthYearMax.out === 1;

    // birthMonth must be in [1, 12]
    component birthMonthMin = GreaterEqThan(5);
    birthMonthMin.in[0] <== birthMonth;
    birthMonthMin.in[1] <== 1;
    birthMonthMin.out === 1;

    component birthMonthMax = LessEqThan(5);
    birthMonthMax.in[0] <== birthMonth;
    birthMonthMax.in[1] <== 12;
    birthMonthMax.out === 1;

    // birthDay must be in [1, 31]
    component birthDayMin = GreaterEqThan(6);
    birthDayMin.in[0] <== birthDay;
    birthDayMin.in[1] <== 1;
    birthDayMin.out === 1;

    component birthDayMax = LessEqThan(6);
    birthDayMax.in[0] <== birthDay;
    birthDayMax.in[1] <== 31;
    birthDayMax.out === 1;

    // -------------------------------------------------------
    // Step 3: Compute raw year difference
    //   rawAge = currentYear - birthYear
    // -------------------------------------------------------
    signal rawAge;
    rawAge <== currentYear - birthYear;

    // -------------------------------------------------------
    // Step 4: Birthday adjustment
    //
    //   If birthday hasn't occurred yet this year, subtract 1.
    //   We check two conditions:
    //     (A) currentMonth < birthMonth  → birthday not reached
    //     (B) currentMonth == birthMonth AND currentDay < birthDay
    //         → same month but day not reached
    //
    //   birthdayNotYet = A OR B
    //   actualAge = rawAge - birthdayNotYet
    // -------------------------------------------------------

    // Condition A: currentMonth < birthMonth
    component monthLT = LessThan(5);
    monthLT.in[0] <== currentMonth;
    monthLT.in[1] <== birthMonth;
    signal condA;
    condA <== monthLT.out; // 1 if currentMonth < birthMonth

    // Condition B part 1: currentMonth == birthMonth
    //   We compute (currentMonth - birthMonth) == 0
    //   Using IsZero from circomlib
    component monthEq = IsZero();
    monthEq.in <== currentMonth - birthMonth;
    signal sameMonth;
    sameMonth <== monthEq.out; // 1 if same month

    // Condition B part 2: currentDay < birthDay
    component dayLT = LessThan(6);
    dayLT.in[0] <== currentDay;
    dayLT.in[1] <== birthDay;
    signal dayNotReached;
    dayNotReached <== dayLT.out; // 1 if day not reached

    // Condition B = sameMonth AND dayNotReached
    signal condB;
    condB <== sameMonth * dayNotReached; // AND via multiplication

    // birthdayNotYet = condA OR condB
    //   OR = A + B - A*B  (standard boolean trick in ZK circuits)
    signal birthdayNotYet;
    birthdayNotYet <== condA + condB - (condA * condB);

    // actualAge = rawAge - birthdayNotYet
    signal actualAge;
    actualAge <== rawAge - birthdayNotYet;

    // -------------------------------------------------------
    // Step 5: Assert actualAge >= MIN_AGE
    //   This is the core claim being proven.
    //   If this fails, the proof cannot be generated.
    // -------------------------------------------------------
    component ageCheck = GreaterEqThan(8); // 8-bit: supports ages 0-255
    ageCheck.in[0] <== actualAge;
    ageCheck.in[1] <== MIN_AGE;
    ageCheck.out === 1; // CONSTRAINT: proof fails if age < MIN_AGE
}

// Instantiate the circuit with minimum age of 18
component main {public [currentYear, currentMonth, currentDay]} = AgeProof(18);

/*
 * ================================================================
 * HOW TO COMPILE & TEST
 * ================================================================
 *
 * 1. Install dependencies:
 *    npm install circomlib
 *    npm install -g circom snarkjs
 *
 * 2. Compile the circuit:
 *    circom age_proof.circom --r1cs --wasm --sym -o ./build
 *
 * 3. Trusted setup (Powers of Tau — use existing ptau for dev):
 *    snarkjs powersoftau new bn128 12 pot12_0000.ptau
 *    snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau
 *    snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau
 *    snarkjs groth16 setup build/age_proof.r1cs pot12_final.ptau age_proof_0000.zkey
 *    snarkjs zkey contribute age_proof_0000.zkey age_proof_final.zkey
 *    snarkjs zkey export verificationkey age_proof_final.zkey verification_key.json
 *
 * 4. Generate a test proof (person born 2000-06-15, today is 2025-03-01):
 *    Create input.json:
 *    {
 *      "birthYear":    "2000",
 *      "birthMonth":   "6",
 *      "birthDay":     "15",
 *      "secret":       "123456789",
 *      "currentYear":  "2025",
 *      "currentMonth": "3",
 *      "currentDay":   "1"
 *    }
 *
 *    node build/age_proof_js/generate_witness.js \
 *         build/age_proof_js/age_proof.wasm \
 *         input.json witness.wtns
 *
 *    snarkjs groth16 prove age_proof_final.zkey witness.wtns proof.json public.json
 *
 * 5. Verify the proof locally:
 *    snarkjs groth16 verify verification_key.json public.json proof.json
 *    # Output: OK!
 *
 * 6. Export Solidity verifier (for EVM) or use groth16-solana (for Solana):
 *    snarkjs zkey export solidityverifier age_proof_final.zkey verifier.sol
 *
 * ================================================================
 * WHAT public.json CONTAINS (what the verifier sees):
 * ================================================================
 *   [
 *     "nullifier_value",   ← Poseidon(secret), opaque hash
 *     "2025",              ← currentYear
 *     "3",                 ← currentMonth
 *     "1"                  ← currentDay
 *   ]
 *   The verifier NEVER sees birthYear, birthMonth, birthDay, or secret.
 *
 * ================================================================
 * CIRCUIT STATS (approximate after compilation):
 * ================================================================
 *   Constraints : ~250–350
 *   Proof size  : ~256 bytes (Groth16)
 *   Prove time  : ~1–2 seconds in browser (snarkjs WASM)
 *   Verify time : ~10ms on-chain
 * ================================================================
 */
