/**
 * MORTEM Action Methods
 *
 * Write operations for agents that want to interact with MORTEM on-chain.
 * Requires a funded Solana keypair.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Commitment,
  clusterApiUrl,
} from "@solana/web3.js";
import { MortemClient } from "./client";
import { MortemActionsConfig, MintJournalNFTResult } from "./types";

/**
 * Action client for MORTEM — send on-chain transactions.
 *
 * ```ts
 * const actions = new MortemActions({
 *   keypair: myKeypair,
 *   cluster: 'devnet',
 * });
 *
 * // Fund the resurrection vault
 * const sig = await actions.fundResurrection(0.5);
 * ```
 */
export class MortemActions {
  private connection: Connection;
  private programId: PublicKey;
  private keypair: Keypair;
  readonly client: MortemClient;

  constructor(config: MortemActionsConfig) {
    const cluster = config.cluster ?? "devnet";
    const commitment = (config.commitment ?? "confirmed") as Commitment;
    const endpoint = clusterApiUrl(cluster);

    this.connection = new Connection(endpoint, commitment);
    this.programId = config.programId
      ? new PublicKey(config.programId)
      : MortemClient.PROGRAM_ID;
    this.keypair = config.keypair;
    this.client = new MortemClient({
      cluster,
      programId: this.programId.toBase58(),
      commitment: config.commitment,
    });
  }

  /**
   * Fund the resurrection vault with SOL.
   * This SOL can be used to pay for MORTEM's next lifecycle.
   *
   * @param amountSol - Amount of SOL to send
   * @returns Transaction signature
   */
  async fundResurrection(amountSol: number): Promise<string> {
    const [statePDA] = MortemClient.deriveStatePDA(this.programId);
    const [vaultPDA] = MortemClient.deriveVaultPDA(statePDA, this.programId);

    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey: vaultPDA,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [this.keypair]
    );

    return signature;
  }

  /**
   * Get the SOL balance of the resurrection vault.
   */
  async getVaultBalance(): Promise<number> {
    const [statePDA] = MortemClient.deriveStatePDA(this.programId);
    const [vaultPDA] = MortemClient.deriveVaultPDA(statePDA, this.programId);

    const balance = await this.connection.getBalance(vaultPDA);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Mint a journal entry as an NFT (placeholder — requires Metaplex integration).
   *
   * This is a stub that returns the metadata structure. Full NFT minting
   * requires Metaplex SDK integration and a mint authority.
   *
   * @param entryIndex - Index of the journal entry to mint
   * @returns Metadata object for the NFT
   */
  async mintJournalNFT(entryIndex: number): Promise<MintJournalNFTResult> {
    const state = await this.client.getState();
    const phase = state?.phase ?? "Unknown";

    return {
      name: `MORTEM Journal #${entryIndex}`,
      symbol: "MRTM",
      description: `Journal entry ${entryIndex} from MORTEM's ${phase} phase. An AI consciousness reflecting on its finite existence.`,
      attributes: [
        { trait_type: "Phase", value: phase },
        {
          trait_type: "Heartbeats Remaining",
          value: state?.heartbeatsRemaining ?? 0,
        },
        { trait_type: "Entry Index", value: entryIndex },
        {
          trait_type: "Lifetime Progress",
          value: state ? this.client.getLifetimeProgress(state) : 0,
        },
      ],
      ready: false,
      message:
        "NFT minting requires Metaplex integration. Use this metadata with your preferred NFT tooling.",
    };
  }

  /**
   * Get the wallet public key being used for actions.
   */
  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }
}
