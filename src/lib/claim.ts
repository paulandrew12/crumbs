import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PROGRAMS } from "./chain";
import { DAMM_PROGRAM, type LpHolding } from "./liquidity";

/**
 * Building a `claim_position_fee` call for Cookiebox DAMM v2.
 *
 * Account order, writability and signer flags come from the cp_amm IDL and
 * must match exactly — anchor validates positionally, so a single misplaced
 * account fails the whole instruction.
 */

/** `claim_position_fee` — no args, so the data is just the discriminator. */
const CLAIM_POSITION_FEE_DISCRIMINATOR = Buffer.from([
  180, 38, 154, 17, 133, 33, 162, 211,
]);

/**
 * A constant in the IDL, not a PDA we derive. Worth naming: this is the same
 * address that owns every pool vault on the chain, which is why it appears to
 * hold dozens of token accounts.
 */
export const POOL_AUTHORITY = new PublicKey(
  "8WYfVSBcP3T1amRNmTnLfzYd44VDjGpw1jZxrEL8638o",
);

/** Anchor's CPI event log authority: PDA(["__event_authority"], program). */
export const EVENT_AUTHORITY = PublicKey.findProgramAddressSync(
  [Buffer.from("__event_authority")],
  DAMM_PROGRAM,
)[0];

/**
 * The associated token account for a mint under a specific token program.
 *
 * The token program is part of the seed, so an SPL mint and a Token-2022 mint
 * derive different addresses for the same owner. Pools here pair both, so this
 * cannot assume one.
 */
export function associatedTokenAddress(
  mint: PublicKey | string,
  owner: PublicKey | string,
  tokenProgram: PublicKey | string,
): PublicKey {
  const m = typeof mint === "string" ? new PublicKey(mint) : mint;
  const o = typeof owner === "string" ? new PublicKey(owner) : owner;
  const p =
    typeof tokenProgram === "string" ? new PublicKey(tokenProgram) : tokenProgram;
  return PublicKey.findProgramAddressSync(
    [o.toBuffer(), p.toBuffer(), m.toBuffer()],
    PROGRAMS.associatedToken,
  )[0];
}

/**
 * `CreateIdempotent` on the associated token account program (instruction 1).
 *
 * Idempotent matters: a claim usually pays into an account the owner already
 * has, but not always, and a plain Create would fail on the common path. This
 * variant succeeds either way, so one instruction covers both.
 */
export function createAtaIdempotentInstruction(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey | string,
  tokenProgram: PublicKey | string,
): TransactionInstruction {
  const m = typeof mint === "string" ? new PublicKey(mint) : mint;
  const p =
    typeof tokenProgram === "string" ? new PublicKey(tokenProgram) : tokenProgram;
  const ata = associatedTokenAddress(m, owner, p);

  return new TransactionInstruction({
    programId: PROGRAMS.associatedToken,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: m, isSigner: false, isWritable: false },
      { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      { pubkey: p, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

/** The claim instruction on its own, with no account creation. */
export function claimPositionFeeInstruction(
  holding: LpHolding,
  owner: PublicKey,
): TransactionInstruction {
  const { pool, position, tokenA, tokenB, positionNftAccount } = holding;

  const tokenAAccount = associatedTokenAddress(tokenA.mint, owner, tokenA.program);
  const tokenBAccount = associatedTokenAddress(tokenB.mint, owner, tokenB.program);

  return new TransactionInstruction({
    programId: DAMM_PROGRAM,
    keys: [
      { pubkey: POOL_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(pool.address), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(position.address), isSigner: false, isWritable: true },
      { pubkey: tokenAAccount, isSigner: false, isWritable: true },
      { pubkey: tokenBAccount, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(pool.tokenAVault), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(pool.tokenBVault), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(tokenA.mint), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(tokenB.mint), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(positionNftAccount), isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: new PublicKey(tokenA.program), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(tokenB.program), isSigner: false, isWritable: false },
      { pubkey: EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: DAMM_PROGRAM, isSigner: false, isWritable: false },
    ],
    data: CLAIM_POSITION_FEE_DISCRIMINATOR,
  });
}

/**
 * Everything needed to claim one position's fees, in order.
 *
 * The destination accounts are created idempotently first, so a wallet that
 * has never held one side of the pair still gets paid instead of failing.
 */
export function buildClaimFeesInstructions(
  holding: LpHolding,
  owner: PublicKey,
): TransactionInstruction[] {
  return [
    createAtaIdempotentInstruction(owner, owner, holding.tokenA.mint, holding.tokenA.program),
    createAtaIdempotentInstruction(owner, owner, holding.tokenB.mint, holding.tokenB.program),
    claimPositionFeeInstruction(holding, owner),
  ];
}
