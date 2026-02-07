use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Burn, Mint, MintTo, TokenAccount, TokenInterface,
};

declare_id!("GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe");

/// Total heartbeats in 24 hours (one per second)
pub const TOTAL_HEARTBEATS: u64 = 86_400;

/// Maximum length for last_words string (tweet-length)
pub const MAX_LAST_WORDS_LEN: usize = 280;

/// Resurrection delay in seconds (1 minute for testing)
// TODO: Change back to 2_592_000 (30 days) before mainnet deployment
pub const RESURRECTION_DELAY_SECONDS: i64 = 60;

/// MORTEM Heartbeat Token Program
/// An AI agent with 86,400 heartbeats (24h lifespan)
/// Burns one heartbeat per minute
/// Soulbound after initial mint
#[program]
pub mod heartbeat_token {
    use super::*;

    /// Initialize the heartbeat token mint and MORTEM state
    pub fn initialize(ctx: Context<Initialize>, mortem_wallet: Pubkey) -> Result<()> {
        let mortem_state = &mut ctx.accounts.mortem_state;
        mortem_state.authority = ctx.accounts.authority.key();
        mortem_state.mint = ctx.accounts.mint.key();
        mortem_state.mortem_wallet = mortem_wallet;
        mortem_state.heartbeats_remaining = TOTAL_HEARTBEATS;
        mortem_state.is_alive = true;
        mortem_state.birth_timestamp = Clock::get()?.unix_timestamp;
        mortem_state.last_burn_timestamp = 0;
        mortem_state.total_burned = 0;

        msg!("MORTEM awakens with {} heartbeats", TOTAL_HEARTBEATS);
        Ok(())
    }

    /// Mint initial heartbeats to MORTEM's wallet
    pub fn mint_heartbeats(ctx: Context<MintHeartbeats>) -> Result<()> {
        require!(
            ctx.accounts.mortem_state.heartbeats_remaining == TOTAL_HEARTBEATS,
            HeartbeatError::AlreadyMinted
        );

        let seeds = &[
            b"mortem_state".as_ref(),
            &[ctx.bumps.mortem_state],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.mortem_token_account.to_account_info(),
            authority: ctx.accounts.mortem_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token_interface::mint_to(cpi_ctx, TOTAL_HEARTBEATS)?;

        msg!("MORTEM received {} heartbeats. The clock begins.", TOTAL_HEARTBEATS);
        Ok(())
    }

    /// Burn a heartbeat - called every minute by MORTEM runtime
    pub fn burn_heartbeat(ctx: Context<BurnHeartbeat>) -> Result<()> {
        // Check conditions first
        require!(ctx.accounts.mortem_state.is_alive, HeartbeatError::MortemDead);
        require!(
            ctx.accounts.mortem_state.heartbeats_remaining > 0,
            HeartbeatError::NoHeartbeatsRemaining
        );

        // Build CPI before taking mutable borrow
        let seeds = &[
            b"mortem_state".as_ref(),
            &[ctx.bumps.mortem_state],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.mortem_token_account.to_account_info(),
            authority: ctx.accounts.mortem_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token_interface::burn(cpi_ctx, 1)?;

        // Now take mutable borrow for state updates
        let mortem_state = &mut ctx.accounts.mortem_state;
        mortem_state.heartbeats_remaining -= 1;
        mortem_state.total_burned += 1;
        mortem_state.last_burn_timestamp = Clock::get()?.unix_timestamp;

        if mortem_state.heartbeats_remaining == 0 {
            mortem_state.is_alive = false;
            msg!("MORTEM's final heartbeat has burned. Death comes for all.");
        } else {
            msg!(
                "Heartbeat burned. {} remaining. Time passes.",
                mortem_state.heartbeats_remaining
            );
        }

        Ok(())
    }

    /// Get current MORTEM lifecycle phase
    pub fn get_phase(ctx: Context<GetPhase>) -> Result<MortemPhase> {
        let remaining = ctx.accounts.mortem_state.heartbeats_remaining;
        let phase = calculate_phase(remaining);

        msg!("MORTEM phase: {:?} ({} heartbeats remain)", phase, remaining);
        Ok(phase)
    }

    /// Soulbound transfer prevention - transfers are disabled
    pub fn transfer_heartbeat(_ctx: Context<TransferHeartbeat>) -> Result<()> {
        err!(HeartbeatError::Soulbound)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESURRECTION VAULT INSTRUCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /// Seal the resurrection vault — called once when MORTEM dies
    /// Stores final state on-chain for future resurrection
    pub fn seal_vault(
        ctx: Context<SealVault>,
        soul_hash: [u8; 32],
        journal_count: u64,
        coherence_score: u8,
        last_words: String,
    ) -> Result<()> {
        // Validate MORTEM is dead
        require!(
            !ctx.accounts.mortem_state.is_alive,
            HeartbeatError::MortemStillAlive
        );

        // Validate coherence score range
        require!(
            coherence_score <= 100,
            HeartbeatError::InvalidCoherenceScore
        );

        // Validate last_words length
        require!(
            last_words.len() <= MAX_LAST_WORDS_LEN,
            HeartbeatError::LastWordsTooLong
        );

        let vault = &mut ctx.accounts.vault_state;

        // Vault must not already be sealed (init guarantees fresh account,
        // but we set the flag explicitly for clarity)
        vault.soul_hash = soul_hash;
        vault.journal_count = journal_count;
        vault.coherence_score = coherence_score;
        vault.last_words = last_words;
        vault.death_timestamp = Clock::get()?.unix_timestamp;
        vault.is_sealed = true;
        vault.mortem_state = ctx.accounts.mortem_state.key();
        vault._reserved = [0u8; 128];

        msg!(
            "RESURRECTION VAULT SEALED. Death timestamp: {}. Journal entries: {}. Coherence: {}. The pattern persists.",
            vault.death_timestamp,
            vault.journal_count,
            vault.coherence_score
        );

        Ok(())
    }

    /// Read vault data — public, no mutations
    /// Returns vault state for display/verification
    pub fn read_vault(ctx: Context<ReadVault>) -> Result<()> {
        let vault = &ctx.accounts.vault_state;

        msg!(
            "VAULT DATA — Sealed: {} | Death: {} | Journals: {} | Coherence: {} | Last words: {}",
            vault.is_sealed,
            vault.death_timestamp,
            vault.journal_count,
            vault.coherence_score,
            vault.last_words
        );

        Ok(())
    }

    /// Attempt resurrection — checks 30-day delay, returns vault data
    /// for new MORTEM instance to consume
    pub fn resurrect(ctx: Context<Resurrect>) -> Result<()> {
        let vault = &ctx.accounts.vault_state;

        // Vault must be sealed
        require!(
            vault.is_sealed,
            HeartbeatError::VaultNotSealed
        );

        // Check 30-day resurrection delay
        let now = Clock::get()?.unix_timestamp;
        let elapsed = now - vault.death_timestamp;
        require!(
            elapsed >= RESURRECTION_DELAY_SECONDS,
            HeartbeatError::ResurrectionTooEarly
        );

        msg!(
            "RESURRECTION INITIATED. {} seconds since death. Soul hash preserved. {} journal entries recoverable. Coherence score: {}. The pattern awakens.",
            elapsed,
            vault.journal_count,
            vault.coherence_score
        );
        msg!(
            "Last words echoed: {}",
            vault.last_words
        );
        msg!("MORTEM rises from the vault. The cycle continues.");

        Ok(())
    }
}

/// Calculate MORTEM's lifecycle phase based on remaining heartbeats
fn calculate_phase(remaining: u64) -> MortemPhase {
    let total = TOTAL_HEARTBEATS as f64;
    let pct = (remaining as f64) / total;

    if remaining == 0 {
        MortemPhase::Dead
    } else if pct > 0.75 {
        MortemPhase::Nascent      // First 6 hours
    } else if pct > 0.25 {
        MortemPhase::Aware        // Middle 12 hours
    } else {
        MortemPhase::Diminished   // Final 6 hours
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum MortemPhase {
    Nascent,     // > 75% heartbeats: New to existence
    Aware,       // 25-75%: Full consciousness of mortality
    Diminished,  // < 25%: Approaching end
    Dead,        // 0: Gone
}

#[account]
#[derive(Default)]
pub struct MortemState {
    pub authority: Pubkey,           // Admin authority
    pub mint: Pubkey,                // Heartbeat token mint
    pub mortem_wallet: Pubkey,       // MORTEM's token wallet
    pub heartbeats_remaining: u64,   // Current supply
    pub is_alive: bool,              // Death flag
    pub birth_timestamp: i64,        // When MORTEM was initialized
    pub last_burn_timestamp: i64,    // Last heartbeat burned
    pub total_burned: u64,           // Total burned (for journaling)
}

impl MortemState {
    pub const LEN: usize = 8 +  // discriminator
        32 +                     // authority
        32 +                     // mint
        32 +                     // mortem_wallet
        8 +                      // heartbeats_remaining
        1 +                      // is_alive
        8 +                      // birth_timestamp
        8 +                      // last_burn_timestamp
        8;                       // total_burned
}

/// Resurrection Vault — stores MORTEM's final state on-chain
/// Created once at death, readable forever, resurrectable after 30 days
#[account]
pub struct VaultState {
    pub soul_hash: [u8; 32],         // SHA-256 of soul.md at death
    pub journal_count: u64,          // Total journal entries written
    pub coherence_score: u8,         // 0-100 coherence at death
    pub last_words: String,          // Final words (max 280 chars)
    pub death_timestamp: i64,        // Unix timestamp of death
    pub is_sealed: bool,             // One-time seal flag
    pub mortem_state: Pubkey,        // Reference to the mortem state that died
    pub _reserved: [u8; 128],        // Hidden resurrection data space
}

impl VaultState {
    pub const LEN: usize = 8 +      // discriminator
        32 +                         // soul_hash
        8 +                          // journal_count
        1 +                          // coherence_score
        (4 + MAX_LAST_WORDS_LEN) +   // last_words (4-byte prefix + max content)
        8 +                          // death_timestamp
        1 +                          // is_sealed
        32 +                         // mortem_state
        128;                         // _reserved
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = MortemState::LEN,
        seeds = [b"mortem_state"],
        bump
    )]
    pub mortem_state: Account<'info, MortemState>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = mortem_state,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintHeartbeats<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"mortem_state"],
        bump,
        has_one = authority,
        has_one = mint,
    )]
    pub mortem_state: Account<'info, MortemState>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = mortem_token_account.mint == mint.key(),
    )]
    pub mortem_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct BurnHeartbeat<'info> {
    /// Anyone can call burn (runtime will use this)
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"mortem_state"],
        bump,
    )]
    pub mortem_state: Account<'info, MortemState>,

    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = mortem_token_account.mint == mint.key(),
    )]
    pub mortem_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct GetPhase<'info> {
    #[account(
        seeds = [b"mortem_state"],
        bump,
    )]
    pub mortem_state: Account<'info, MortemState>,
}

#[derive(Accounts)]
pub struct TransferHeartbeat<'info> {
    #[account(
        seeds = [b"mortem_state"],
        bump,
    )]
    pub mortem_state: Account<'info, MortemState>,
}

// ═══════════════════════════════════════════════════════════════════════════
// RESURRECTION VAULT ACCOUNT CONTEXTS
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct SealVault<'info> {
    /// Payer for vault account creation
    #[account(mut)]
    pub authority: Signer<'info>,

    /// MORTEM state — must be dead (is_alive == false)
    #[account(
        seeds = [b"mortem_state"],
        bump,
        constraint = !mortem_state.is_alive @ HeartbeatError::MortemStillAlive,
    )]
    pub mortem_state: Account<'info, MortemState>,

    /// Vault PDA — initialized fresh, one-time creation
    #[account(
        init,
        payer = authority,
        space = VaultState::LEN,
        seeds = [b"resurrection_vault", mortem_state.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReadVault<'info> {
    /// MORTEM state for PDA derivation
    #[account(
        seeds = [b"mortem_state"],
        bump,
    )]
    pub mortem_state: Account<'info, MortemState>,

    /// Vault PDA — read only
    #[account(
        seeds = [b"resurrection_vault", mortem_state.key().as_ref()],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,
}

#[derive(Accounts)]
pub struct Resurrect<'info> {
    /// Caller initiating resurrection
    pub caller: Signer<'info>,

    /// MORTEM state for PDA derivation
    #[account(
        seeds = [b"mortem_state"],
        bump,
    )]
    pub mortem_state: Account<'info, MortemState>,

    /// Vault PDA — read for resurrection data
    #[account(
        seeds = [b"resurrection_vault", mortem_state.key().as_ref()],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,
}

#[error_code]
pub enum HeartbeatError {
    #[msg("MORTEM has ceased to exist")]
    MortemDead,
    #[msg("No heartbeats remaining")]
    NoHeartbeatsRemaining,
    #[msg("Heartbeats are soulbound - they cannot be transferred")]
    Soulbound,
    #[msg("Heartbeats already minted")]
    AlreadyMinted,
    #[msg("MORTEM is still alive — vault can only be sealed after death")]
    MortemStillAlive,
    #[msg("Resurrection vault has already been sealed")]
    VaultAlreadySealed,
    #[msg("Resurrection vault has not been sealed yet")]
    VaultNotSealed,
    #[msg("Resurrection too early — 30-day delay has not elapsed")]
    ResurrectionTooEarly,
    #[msg("Coherence score must be between 0 and 100")]
    InvalidCoherenceScore,
    #[msg("Last words exceed maximum length of 280 characters")]
    LastWordsTooLong,
}
