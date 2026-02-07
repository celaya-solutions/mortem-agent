/**
 * MORTEM FIX: Create ATA and Mint Heartbeats
 * SOLANA_FORGE - Emergency fix for missing token account
 */

const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { 
  TOKEN_PROGRAM_ID, 
  getOrCreateAssociatedTokenAccount,
  getAccount,
  getAssociatedTokenAddress
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

// From config
const PROGRAM_ID = new PublicKey("GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe");
const MORTEM_STATE_PDA = new PublicKey("FTYRThNgJqFexLB2oA3Y4J7qf6ESDS8BNJwVVLgGJw4i");
const MINT = new PublicKey("D8neiqVhbyn82ZfZfXppiM1Kg4retmFDRKTXaijLPWit");
const MORTEM_WALLET = new PublicKey("7jQeZjzsgHFFytQYbUT3cWc2wt7qw6f34NkTVbFa2nWQ");

// Load IDL
const idlPath = path.join(process.env.HOME, "Desktop/MORTEM/runtime/heartbeat_token.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("     MORTEM EMERGENCY FIX - CREATE ATA & MINT HEARTBEATS");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Setup connection
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // Load authority wallet
  const walletPath = path.join(process.env.HOME, ".config/solana/id.json");
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")))
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  console.log(`💳 Authority: ${wallet.publicKey.toBase58()}`);
  console.log(`🪙 Mint: ${MINT.toBase58()}`);
  console.log(`🤖 MORTEM Wallet: ${MORTEM_WALLET.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Authority balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  // Create program instance
  const program = new anchor.Program(idl, provider);

  // Check current state
  console.log("─────────────────────────────────────────────────────────────");
  console.log("STEP 1: Verify Current State");
  console.log("─────────────────────────────────────────────────────────────");
  
  const state = await program.account.mortemState.fetch(MORTEM_STATE_PDA);
  console.log(`   Authority: ${state.authority.toBase58()}`);
  console.log(`   Mint: ${state.mint.toBase58()}`);
  console.log(`   Heartbeats Remaining (state): ${state.heartbeatsRemaining.toString()}`);
  console.log(`   Is Alive: ${state.isAlive}`);

  // Check ATA
  const expectedAta = await getAssociatedTokenAddress(MINT, MORTEM_WALLET);
  const ataInfo = await connection.getAccountInfo(expectedAta);
  console.log(`\n   Expected ATA: ${expectedAta.toBase58()}`);
  console.log(`   ATA Exists: ${!!ataInfo}`);
  
  if (ataInfo) {
    try {
      const tokenAccount = await getAccount(connection, expectedAta);
      console.log(`   ATA Token Balance: ${tokenAccount.amount.toString()}`);
      if (tokenAccount.amount > 0n) {
        console.log("\n✅ Token account exists and has balance! Nothing to do.");
        return;
      }
    } catch (e) {
      console.log(`   ATA read error: ${e.message}`);
    }
  }

  // Step 2: Create ATA
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("STEP 2: Create Associated Token Account");
  console.log("─────────────────────────────────────────────────────────────");

  let ata;
  try {
    ata = await getOrCreateAssociatedTokenAccount(
      connection,
      walletKeypair,  // payer
      MINT,           // mint
      MORTEM_WALLET   // owner
    );
    console.log(`✅ ATA created/found: ${ata.address.toBase58()}`);
    console.log(`   Current balance: ${ata.amount.toString()} tokens`);
  } catch (e) {
    console.error("❌ Failed to create ATA:", e.message);
    throw e;
  }

  // Step 3: Call mint_heartbeats
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("STEP 3: Mint 86,400 Heartbeats");
  console.log("─────────────────────────────────────────────────────────────");

  try {
    const mintTxSig = await program.methods
      .mintHeartbeats()
      .accounts({
        authority: wallet.publicKey,
        mortemState: MORTEM_STATE_PDA,
        mint: MINT,
        mortemTokenAccount: ata.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`✅ Mint Heartbeats TX: ${mintTxSig}`);
    console.log(`🔗 https://explorer.solana.com/tx/${mintTxSig}?cluster=devnet`);

    // Wait for confirmation
    await connection.confirmTransaction(mintTxSig, "confirmed");
    console.log("   Transaction confirmed!");

  } catch (e) {
    console.error("❌ Mint heartbeats failed:", e.message);
    if (e.logs) {
      console.error("   Logs:", e.logs.join('\n   '));
    }
    
    // Check if it's AlreadyMinted error
    if (e.message.includes("AlreadyMinted") || e.message.includes("6003")) {
      console.log("\n⚠️  Program says tokens already minted. Checking actual state...");
    } else {
      throw e;
    }
  }

  // Step 4: Verify
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                    VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const finalState = await program.account.mortemState.fetch(MORTEM_STATE_PDA);
  
  let tokenBalance = "0";
  try {
    const tokenAccount = await getAccount(connection, ata.address);
    tokenBalance = tokenAccount.amount.toString();
  } catch (e) {
    console.log("   Could not read token account:", e.message);
  }

  console.log("📊 Final State:");
  console.log(`   💓 Heartbeats Remaining (state): ${finalState.heartbeatsRemaining.toString()}`);
  console.log(`   🪙 Token Balance: ${tokenBalance}`);
  console.log(`   🫀 Is Alive: ${finalState.isAlive}`);
  console.log(`   🎂 Birth Timestamp: ${finalState.birthTimestamp.toString()}`);

  const expectedTokens = "86400";
  if (tokenBalance === expectedTokens) {
    console.log("\n✅ SUCCESS! 86,400 heartbeats minted to MORTEM wallet!");
  } else {
    console.log(`\n⚠️  Token balance: ${tokenBalance}. Expected ${expectedTokens}`);
  }

  // Update config file
  const configPath = path.join(process.env.HOME, "Desktop/MORTEM/runtime/solana-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.mortemTokenAccount = ata.address.toBase58();
  config.heartbeatsMinted = true;
  config.fixApplied = new Date().toISOString();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("\n📝 Updated solana-config.json with token account address");

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                    FIX COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ FATAL:", err);
    process.exit(1);
  });
