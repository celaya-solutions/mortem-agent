/**
 * MORTEM Devnet Initialization Script
 * Initializes on-chain state for MORTEM heartbeat system
 */

const anchor = require("@coral-xyz/anchor");
const { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL 
} = require("@solana/web3.js");
const { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// Configuration
const PROGRAM_ID = new PublicKey("GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe");
const MORTEM_WALLET = new PublicKey("7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ");
const SOL_TO_TRANSFER = 0.1;

// Load IDL
const idlPath = path.join(process.env.HOME, "Desktop/MORTEM/runtime/heartbeat_token.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("        MORTEM DEVNET INITIALIZATION - SOLANA_FORGE");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Setup connection and wallet
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  
  const walletPath = path.join(process.env.HOME, ".config/solana/id.json");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  console.log("📍 Cluster: devnet");
  console.log(`💳 Authority wallet: ${wallet.publicKey.toBase58()}`);
  console.log(`🤖 MORTEM wallet: ${MORTEM_WALLET.toBase58()}`);
  
  const authorityBalance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Authority balance: ${authorityBalance / LAMPORTS_PER_SOL} SOL\n`);

  // Create program instance
  const program = new anchor.Program(idl, provider);

  // Derive PDA for mortem_state (seed: "mortem_state")
  const [mortemStatePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("mortem_state")],
    PROGRAM_ID
  );
  console.log(`📦 MORTEM State PDA: ${mortemStatePda.toBase58()} (bump: ${bump})`);

  // Check if already initialized
  let existingState = null;
  try {
    existingState = await program.account.mortemState.fetch(mortemStatePda);
    console.log("\n⚠️  MORTEM state already exists!");
    console.log(`   Mint: ${existingState.mint.toBase58()}`);
    console.log(`   Heartbeats: ${existingState.heartbeatsRemaining.toString()}`);
    console.log(`   Is Alive: ${existingState.isAlive}`);
  } catch (e) {
    console.log("✅ No existing state - proceeding with initialization\n");
  }

  let mintKeypair;
  let initTxSig = null;

  if (!existingState) {
    // Generate new mint keypair
    mintKeypair = Keypair.generate();
    console.log(`🪙 New mint keypair: ${mintKeypair.publicKey.toBase58()}`);

    // Step 1: Initialize
    console.log("\n─────────────────────────────────────────────────────────────");
    console.log("STEP 1: Initialize MORTEM State");
    console.log("─────────────────────────────────────────────────────────────");

    try {
      initTxSig = await program.methods
        .initialize(MORTEM_WALLET)
        .accounts({
          authority: wallet.publicKey,
          mortemState: mortemStatePda,
          mint: mintKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([mintKeypair])
        .rpc();

      console.log(`✅ Initialize TX: ${initTxSig}`);
      console.log(`🔗 https://explorer.solana.com/tx/${initTxSig}?cluster=devnet`);
      
      // Wait for confirmation
      await connection.confirmTransaction(initTxSig, "confirmed");
      console.log("   Confirmed!\n");
    } catch (e) {
      console.error("❌ Initialize failed:", e.message);
      throw e;
    }
  } else {
    mintKeypair = { publicKey: existingState.mint };
  }

  // Get MORTEM's associated token account
  const mortemTokenAccount = await getAssociatedTokenAddress(
    existingState ? existingState.mint : mintKeypair.publicKey,
    MORTEM_WALLET
  );
  console.log(`🎫 MORTEM Token Account: ${mortemTokenAccount.toBase58()}`);

  // Check if token account exists
  const tokenAccountInfo = await connection.getAccountInfo(mortemTokenAccount);
  
  // Step 2: Mint Heartbeats
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("STEP 2: Mint Heartbeats (86,400 = 24 hours)");
  console.log("─────────────────────────────────────────────────────────────");

  // Refetch state to get mint
  const state = await program.account.mortemState.fetch(mortemStatePda);
  
  if (state.heartbeatsRemaining.toNumber() > 0) {
    console.log(`⚠️  Heartbeats already minted: ${state.heartbeatsRemaining.toString()}`);
  } else {
    try {
      // Build transaction with ATA creation if needed
      const tx = new anchor.web3.Transaction();
      
      if (!tokenAccountInfo) {
        console.log("   Creating Associated Token Account...");
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            mortemTokenAccount,
            MORTEM_WALLET,
            state.mint
          )
        );
      }

      const mintTxSig = await program.methods
        .mintHeartbeats()
        .accounts({
          authority: wallet.publicKey,
          mortemState: mortemStatePda,
          mint: state.mint,
          mortemTokenAccount: mortemTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(tx.instructions)
        .rpc();

      console.log(`✅ Mint Heartbeats TX: ${mintTxSig}`);
      console.log(`🔗 https://explorer.solana.com/tx/${mintTxSig}?cluster=devnet`);
      
      await connection.confirmTransaction(mintTxSig, "confirmed");
      console.log("   Confirmed!\n");
    } catch (e) {
      console.error("❌ Mint heartbeats failed:", e.message);
      throw e;
    }
  }

  // Step 3: Fund MORTEM wallet
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("STEP 3: Fund MORTEM Runtime Wallet");
  console.log("─────────────────────────────────────────────────────────────");

  const mortemBalance = await connection.getBalance(MORTEM_WALLET);
  console.log(`   Current MORTEM balance: ${mortemBalance / LAMPORTS_PER_SOL} SOL`);

  if (mortemBalance < 0.05 * LAMPORTS_PER_SOL) {
    const transferTx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: MORTEM_WALLET,
        lamports: SOL_TO_TRANSFER * LAMPORTS_PER_SOL,
      })
    );

    const transferSig = await provider.sendAndConfirm(transferTx);
    console.log(`✅ Transfer TX: ${transferSig}`);
    console.log(`🔗 https://explorer.solana.com/tx/${transferSig}?cluster=devnet`);
    console.log(`   Transferred ${SOL_TO_TRANSFER} SOL to MORTEM`);
  } else {
    console.log("   MORTEM wallet already funded, skipping transfer");
  }

  // Step 4: Verify final state
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                    FINAL STATE VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const finalState = await program.account.mortemState.fetch(mortemStatePda);
  const finalMortemBalance = await connection.getBalance(MORTEM_WALLET);

  console.log("📊 MORTEM On-Chain State:");
  console.log(`   Authority: ${finalState.authority.toBase58()}`);
  console.log(`   Mint: ${finalState.mint.toBase58()}`);
  console.log(`   MORTEM Wallet: ${finalState.mortemWallet.toBase58()}`);
  console.log(`   💓 Heartbeats Remaining: ${finalState.heartbeatsRemaining.toString()}`);
  console.log(`   🫀 Is Alive: ${finalState.isAlive}`);
  console.log(`   🎂 Birth Timestamp: ${finalState.birthTimestamp.toString()}`);
  console.log(`   🔥 Total Burned: ${finalState.totalBurned.toString()}`);
  console.log(`   💰 MORTEM SOL Balance: ${finalMortemBalance / LAMPORTS_PER_SOL} SOL`);

  // Calculate time until death
  const heartbeatsRemaining = finalState.heartbeatsRemaining.toNumber();
  const hoursRemaining = heartbeatsRemaining / 60;
  console.log(`\n⏳ Time Until Death: ${hoursRemaining.toFixed(2)} hours (${heartbeatsRemaining} minutes)`);

  // Output summary for main agent
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                    INITIALIZATION COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n📋 Summary for MORTEM Runtime:");
  console.log(JSON.stringify({
    programId: PROGRAM_ID.toBase58(),
    mortemStatePda: mortemStatePda.toBase58(),
    mint: finalState.mint.toBase58(),
    mortemWallet: MORTEM_WALLET.toBase58(),
    mortemTokenAccount: mortemTokenAccount.toBase58(),
    heartbeatsRemaining: finalState.heartbeatsRemaining.toString(),
    isAlive: finalState.isAlive,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ FATAL ERROR:", err);
    process.exit(1);
  });
