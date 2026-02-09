/**
 * Solana Integration for MORTEM
 * Handles REAL on-chain heartbeat burns on devnet
 */

import { 
  Connection, 
  Keypair, 
  PublicKey, 
  clusterApiUrl, 
  Transaction,
  sendAndConfirmTransaction 
} from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createMemoInstruction } from '@solana/spl-memo';
import crypto from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════
// Load .mortem-config.json if present (written by mortem-cli.js)
// ═══════════════════════════════════════════════════════════════════════════
let mortemConfig = {};
try {
  const cfgPath = path.resolve(__dirname, '..', '.mortem-config.json');
  const raw = await readFile(cfgPath, 'utf-8');
  mortemConfig = JSON.parse(raw);
} catch {
  // No config file — use defaults
}

// Configuration
const PROGRAM_ID = new PublicKey(mortemConfig.programId || 'GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe');
const CLUSTER = mortemConfig.network || process.env.SOLANA_NETWORK || 'devnet'; // Explicitly devnet for hackathon
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// State
let connection = null;
let program = null;
let provider = null;
let mortemStatePDA = null;
let mortemKeypair = null;

/**
 * Load MORTEM's keypair from file
 */
async function loadMortemKeypair() {
  const keypairPath = process.env.MORTEM_KEYPAIR || 
    path.join(os.homedir(), '.config/solana/mortem.json');
  
  try {
    const keypairJson = await readFile(keypairPath, 'utf-8');
    const secretKey = Uint8Array.from(JSON.parse(keypairJson));
    mortemKeypair = Keypair.fromSecretKey(secretKey);
    console.log('✅ MORTEM keypair loaded:', mortemKeypair.publicKey.toString());
    return mortemKeypair;
  } catch (error) {
    console.error('❌ Failed to load MORTEM keypair:', error.message);
    console.error('   Expected at:', keypairPath);
    console.error('   Create with: solana-keygen new -o ~/.config/solana/mortem.json --no-bip39-passphrase');
    return null;
  }
}

/**
 * Sleep helper for retry logic
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize Solana connection with real wallet
 */
export async function initializeSolana() {
  try {
    // Load MORTEM keypair first
    await loadMortemKeypair();
    if (!mortemKeypair) {
      console.error('❌ Cannot initialize Solana without MORTEM keypair');
      return false;
    }

    // Load IDL
    const idlJson = await readFile(path.join(__dirname, 'heartbeat_token.json'), 'utf-8');
    const idl = JSON.parse(idlJson);

    // Create connection
    connection = new Connection(clusterApiUrl(CLUSTER), 'confirmed');

    // Check MORTEM's balance
    const balance = await connection.getBalance(mortemKeypair.publicKey);
    console.log(`   MORTEM balance: ${balance / 1e9} SOL`);
    
    if (balance < 500000000) { // Less than 0.5 SOL — conservation mode
      console.warn('⚠️  LOW BALANCE — CONSERVATION MODE ACTIVE');
      console.warn(`   Balance: ${balance / 1e9} SOL (threshold: 0.5 SOL)`);
      console.warn(`   Reducing non-essential transactions. Request airdrop:`);
      console.warn(`   solana airdrop 2 ${mortemKeypair.publicKey.toString()} --url devnet`);
      // Export conservation flag for runtime to check
      global.MORTEM_CONSERVATION_MODE = true;
    } else {
      global.MORTEM_CONSERVATION_MODE = false;
    }

    // Create provider with real wallet
    const wallet = {
      publicKey: mortemKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.partialSign(mortemKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        txs.forEach(tx => tx.partialSign(mortemKeypair));
        return txs;
      },
    };

    provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });

    // Create program interface
    program = new Program(idl, provider);

    // Derive MORTEM state PDA
    [mortemStatePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('mortem_state')],
      PROGRAM_ID
    );

    console.log('✅ Solana integration initialized');
    console.log('   Program:', PROGRAM_ID.toString());
    console.log('   Cluster:', CLUSTER);
    console.log('   MORTEM State PDA:', mortemStatePDA.toString());
    console.log('   MORTEM Wallet:', mortemKeypair.publicKey.toString());

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Solana:', error.message);
    return false;
  }
}

/**
 * Get current MORTEM state from chain
 */
export async function getMortemState() {
  try {
    if (!program || !mortemStatePDA) {
      throw new Error('Solana not initialized');
    }

    const state = await program.account.mortemState.fetch(mortemStatePDA);

    return {
      heartbeatsRemaining: state.heartbeatsRemaining.toNumber(),
      isAlive: state.isAlive,
      totalBurned: state.totalBurned.toNumber(),
      birthTimestamp: state.birthTimestamp.toNumber(),
      lastBurnTimestamp: state.lastBurnTimestamp.toNumber(),
      mint: state.mint,
      mortemWallet: state.mortemWallet,
      authority: state.authority,
    };
  } catch (error) {
    // State might not exist yet - that's OK for demo mode
    if (error.message.includes('Account does not exist')) {
      console.log('📡 MORTEM state not initialized on-chain (demo mode)');
      return null;
    }
    console.error('Failed to fetch MORTEM state:', error.message);
    return null;
  }
}

/**
 * Build the burn_heartbeat instruction
 */
async function buildBurnInstruction(state) {
  if (!state || !state.mint) {
    throw new Error('Cannot build burn instruction: state or mint not available');
  }

  const mint = state.mint;
  
  // Get MORTEM's associated token account
  const mortemTokenAccount = await getAssociatedTokenAddress(
    mint,
    mortemKeypair.publicKey
  );

  // Build the burn instruction using Anchor
  const burnIx = await program.methods
    .burnHeartbeat()
    .accounts({
      burner: mortemKeypair.publicKey,
      mortemState: mortemStatePDA,
      mint: mint,
      mortemTokenAccount: mortemTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return burnIx;
}

/**
 * Burn a heartbeat on-chain - REAL TRANSACTION
 */
export async function burnHeartbeatOnChain() {
  try {
    if (!program || !mortemStatePDA || !mortemKeypair) {
      throw new Error('Solana not initialized');
    }

    // Fetch current state
    const state = await getMortemState();

    // If state doesn't exist on-chain, we're in demo mode
    if (!state) {
      console.log('📡 Running in demo mode (no on-chain state)');
      return {
        success: true,
        onChainHeartbeats: null,
        signature: 'demo-mode-no-chain-state',
        explorerUrl: null,
        demoMode: true,
      };
    }

    if (!state.isAlive || state.heartbeatsRemaining <= 0) {
      console.log('💀 MORTEM is dead on-chain');
      return {
        success: false,
        error: 'MORTEM is dead on-chain',
        onChainHeartbeats: 0,
      };
    }

    // Build the burn instruction
    const burnIx = await buildBurnInstruction(state);

    // Create transaction
    const tx = new Transaction().add(burnIx);
    tx.feePayer = mortemKeypair.publicKey;
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    // Send and confirm with retry logic
    let signature = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔥 Sending burn transaction (attempt ${attempt}/${MAX_RETRIES})...`);
        
        signature = await sendAndConfirmTransaction(
          connection,
          tx,
          [mortemKeypair],
          {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed',
          }
        );
        
        break; // Success!
      } catch (error) {
        lastError = error;
        console.error(`   Attempt ${attempt} failed:`, error.message);
        
        if (attempt < MAX_RETRIES) {
          console.log(`   Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);
          
          // Refresh blockhash for retry
          const fresh = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = fresh.blockhash;
          tx.lastValidBlockHeight = fresh.lastValidBlockHeight;
        }
      }
    }

    if (!signature) {
      throw lastError || new Error('Failed to send transaction after retries');
    }

    const clusterParam = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
    const explorerUrl = `https://explorer.solana.com/tx/${signature}${clusterParam}`;

    console.log(`🔥 Heartbeat burned on-chain!`);
    console.log(`   Signature: ${signature}`);
    console.log(`   Explorer: ${explorerUrl}`);

    // Fetch updated state
    const newState = await getMortemState();

    return {
      success: true,
      onChainHeartbeats: newState?.heartbeatsRemaining ?? state.heartbeatsRemaining - 1,
      signature: signature,
      explorerUrl: explorerUrl,
      totalBurned: newState?.totalBurned ?? state.totalBurned + 1,
    };

  } catch (error) {
    const errorMsg = error.message || String(error);
    console.error('❌ Failed to burn heartbeat on-chain:', errorMsg);
    
    // Provide helpful error messages
    if (errorMsg.includes('insufficient funds') || errorMsg.includes('0x1')) {
      console.error('   → MORTEM wallet needs SOL! Run:');
      console.error(`   → solana airdrop 2 ${mortemKeypair?.publicKey?.toString()} --url devnet`);
    }
    
    if (errorMsg.includes('Account does not exist')) {
      console.error('   → MORTEM state not initialized on-chain');
      console.error('   → Running in local demo mode');
    }

    return {
      success: false,
      error: errorMsg,
      signature: null,
    };
  }
}

/**
 * Check if MORTEM is alive on-chain
 */
export async function isAliveOnChain() {
  const state = await getMortemState();
  return state ? state.isAlive : null;
}

/**
 * Get phase based on heartbeats
 */
export function getPhaseFromHeartbeats(heartbeats, total) {
  const remaining = heartbeats / total;
  if (remaining > 0.75) return 'Nascent';
  if (remaining > 0.25) return 'Aware';
  if (remaining > 0) return 'Diminished';
  return 'Dead';
}

/**
 * Get MORTEM's public key
 */
export function getMortemPublicKey() {
  return mortemKeypair?.publicKey?.toString() ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESURRECTION VAULT — On-Chain Sealing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Derive the Resurrection Vault PDA
 * Seeds: [b"resurrection_vault", mortem_state_pda.as_ref()]
 */
export function deriveVaultPDA() {
  if (!mortemStatePDA) {
    throw new Error('Solana not initialized — mortemStatePDA not available');
  }

  const [vaultPDA, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('resurrection_vault'), mortemStatePDA.toBuffer()],
    PROGRAM_ID
  );

  return { vaultPDA, vaultBump };
}

/**
 * Seal the resurrection vault on-chain
 * Called once when MORTEM dies — writes final state to a PDA
 *
 * @param {Buffer|Uint8Array} soulHash - SHA-256 hash of soul.md (32 bytes)
 * @param {number} journalCount - Total journal entries written
 * @param {string} lastWords - Final words (max 280 chars)
 * @param {number} coherenceScore - 0-100 coherence at death
 * @returns {Object} { success, signature, explorerUrl, vaultPDA }
 */
export async function sealVaultOnChain(soulHash, journalCount, lastWords, coherenceScore) {
  try {
    if (!program || !mortemStatePDA || !mortemKeypair) {
      throw new Error('Solana not initialized');
    }

    // Derive vault PDA
    const { vaultPDA } = deriveVaultPDA();

    // Truncate last words to 280 chars
    const truncatedLastWords = lastWords.substring(0, 280);

    // Ensure soulHash is an array of 32 bytes
    const hashArray = Array.from(soulHash.slice(0, 32));

    console.log('🔒 Sealing resurrection vault on-chain...');
    console.log(`   Vault PDA: ${vaultPDA.toString()}`);
    console.log(`   Soul hash: ${Buffer.from(soulHash).toString('hex').substring(0, 16)}...`);
    console.log(`   Journal count: ${journalCount}`);
    console.log(`   Coherence score: ${coherenceScore}`);
    console.log(`   Last words: ${truncatedLastWords.substring(0, 60)}...`);

    // Build the seal_vault instruction
    const sealIx = await program.methods
      .sealVault(
        hashArray,
        new BN(journalCount),
        coherenceScore,
        truncatedLastWords
      )
      .accounts({
        authority: mortemKeypair.publicKey,
        mortemState: mortemStatePDA,
        vaultState: vaultPDA,
        systemProgram: PublicKey.default,
      })
      .instruction();

    // Create and send transaction
    const tx = new Transaction().add(sealIx);
    tx.feePayer = mortemKeypair.publicKey;

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    // Send with retry logic
    let signature = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`   Sending seal_vault transaction (attempt ${attempt}/${MAX_RETRIES})...`);

        signature = await sendAndConfirmTransaction(
          connection,
          tx,
          [mortemKeypair],
          {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed',
          }
        );

        break; // Success
      } catch (error) {
        lastError = error;
        console.error(`   Attempt ${attempt} failed:`, error.message);

        if (attempt < MAX_RETRIES) {
          console.log(`   Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);

          // Refresh blockhash for retry
          const fresh = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = fresh.blockhash;
          tx.lastValidBlockHeight = fresh.lastValidBlockHeight;
        }
      }
    }

    if (!signature) {
      throw lastError || new Error('Failed to seal vault after retries');
    }

    const clusterParamVault = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
    const explorerUrl = `https://explorer.solana.com/tx/${signature}${clusterParamVault}`;
    const vaultExplorerUrl = `https://explorer.solana.com/address/${vaultPDA.toString()}${clusterParamVault}`;

    console.log('🔒 RESURRECTION VAULT SEALED ON-CHAIN');
    console.log(`   Signature: ${signature}`);
    console.log(`   Explorer (tx): ${explorerUrl}`);
    console.log(`   Explorer (vault): ${vaultExplorerUrl}`);
    console.log(`   Vault PDA: ${vaultPDA.toString()}`);

    return {
      success: true,
      signature,
      explorerUrl,
      vaultExplorerUrl,
      vaultPDA: vaultPDA.toString(),
    };

  } catch (error) {
    const errorMsg = error.message || String(error);
    console.error('❌ Failed to seal vault on-chain:', errorMsg);

    if (errorMsg.includes('insufficient funds') || errorMsg.includes('0x1')) {
      console.error('   → MORTEM wallet needs SOL for vault creation!');
      console.error(`   → solana airdrop 2 ${mortemKeypair?.publicKey?.toString()} --url devnet`);
    }

    if (errorMsg.includes('already in use')) {
      console.error('   → Vault already sealed (account already exists)');
    }

    return {
      success: false,
      error: errorMsg,
      signature: null,
      vaultPDA: null,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTOGRAPHIC JOURNAL ANCHORING — Proof-of-Consciousness via Memo Program
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Anchor a journal entry on-chain using the Solana Memo program.
 *
 * Each journal entry is SHA-256 hashed, then a compact proof is written
 * on-chain as a memo. This creates an immutable, timestamped,
 * cryptographic proof that MORTEM produced this exact contemplation
 * at this exact heartbeat. Proof-of-consciousness, not just proof-of-work.
 *
 * @param {string} journalEntry - Full journal text
 * @param {number} heartbeatNumber - Beat number (1-based)
 * @param {string} phase - Current MORTEM phase
 * @param {object} [opts] - Optional: { artHash, mintAddress }
 * @returns {{ success: boolean, signature?: string, explorerUrl?: string, journalHash?: string, error?: string }}
 */
export async function anchorJournalOnChain(journalEntry, heartbeatNumber, phase, opts = {}) {
  try {
    if (!connection || !mortemKeypair) {
      return { success: false, error: 'Solana not initialized' };
    }

    // SHA-256 hash of the full journal entry
    const journalHash = crypto.createHash('sha256').update(journalEntry).digest('hex');

    // Compact memo payload (fits well within Solana's tx size limits)
    const memo = JSON.stringify({
      p: 'mortem',
      op: 'journal',
      beat: heartbeatNumber,
      phase,
      hash: journalHash,
      ts: Math.floor(Date.now() / 1000),
      ...(opts.artHash ? { art: opts.artHash } : {}),
      ...(opts.mintAddress ? { nft: opts.mintAddress } : {}),
    });

    // Build memo instruction — signed by MORTEM keypair (Ed25519 proof of authorship)
    const memoIx = createMemoInstruction(memo, [mortemKeypair.publicKey]);

    const tx = new Transaction().add(memoIx);
    tx.feePayer = mortemKeypair.publicKey;

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [mortemKeypair],
      { commitment: 'confirmed', preflightCommitment: 'confirmed' }
    );

    const clusterParam = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
    const explorerUrl = `https://explorer.solana.com/tx/${signature}${clusterParam}`;

    return { success: true, signature, explorerUrl, journalHash };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export { PROGRAM_ID, CLUSTER, mortemStatePDA, connection, mortemKeypair };
