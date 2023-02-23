use anchor_lang::prelude::*;
use anchor_spl::token::{self as token_cpi, Token, TokenAccount, Transfer};
use drift::{
    cpi::{self as drift_cpi, accounts::UpdateSpotMarketCumulativeInterest},
    program::Drift,
    state::{
        spot_market::SpotMarket,
        state::State as DriftState,
        user::{User as DriftSubaccount, UserStats as DriftStats},
    },
};

use crate::{
    drift_withdraw_collateral_context_impl,
    helpers::hedge::{sync_vault_collateral_interest_growth, update_user_collateral_interest},
    state::{UserPosition, VaultState},
};

pub fn handler(ctx: Context<ClaimUserCollateralInterest>) -> Result<()> {
    // 1. update collateral spot market and sync vault and user position
    drift_cpi::update_spot_market_cumulative_interest(CpiContext::new(
        ctx.accounts.drift_program.to_account_info(),
        UpdateSpotMarketCumulativeInterest {
            state: ctx.accounts.drift_state.to_account_info(),
            spot_market: ctx.accounts.drift_collateral_spot_market.to_account_info(),
            oracle: ctx.accounts.drift_quote_token_oracle.to_account_info(),
        },
    ))?;

    let drift_subaccount = ctx.accounts.drift_subaccount.load()?;
    let collateral_spot_market = ctx.accounts.drift_collateral_spot_market.load()?;

    sync_vault_collateral_interest_growth(
        &mut ctx.accounts.vault_state,
        &drift_subaccount,
        &collateral_spot_market,
    )?;

    update_user_collateral_interest(&mut ctx.accounts.user_position, &ctx.accounts.vault_state)?;

    // 2. withdraw unclaimed interest from drift
    let collateral_interest_claimable = ctx.accounts.user_position.collateral_interest_unclaimed;

    drift_cpi::withdraw(
        ctx.accounts.drift_withdraw_collateral_context(),
        0_u16,
        collateral_interest_claimable,
        true,
    )?;

    // 3. transfer from vault to owner
    let signer_seeds: &[&[&[u8]]] = &[&[
        VaultState::NAMESPACE.as_ref(),
        ctx.accounts.vault_state.whirlpool.as_ref(),
        &[ctx.accounts.vault_state.bump],
    ]];
    token_cpi::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_quote_token_account.to_account_info(),
                to: ctx.accounts.owner_quote_token_account.to_account_info(),
                authority: ctx.accounts.vault_state.to_account_info(),
            },
        )
        .with_signer(signer_seeds),
        collateral_interest_claimable,
    )?;

    // 4. update program accounts
    ctx.accounts
        .vault_state
        .claim_user_collateral_interest(collateral_interest_claimable)?;
    ctx.accounts.user_position.claim_collateral_interest();

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimUserCollateralInterest<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        token::authority = owner,
        token::mint = vault_state.quote_token_mint,
    )]
    pub owner_quote_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump = user_position.bump,
    )]
    pub user_position: Box<Account<'info, UserPosition>>,

    #[account(
        mut,
        constraint = vault_state.hedge_positions_count > 0,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        address = vault_state.quote_token_account,
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,

    pub drift_state: Box<Account<'info, DriftState>>,
    /// CHECKED: Drift CPI
    pub drift_signer: UncheckedAccount<'info>,

    #[account(
        mut,
        address = vault_state.drift_stats,
    )]
    pub drift_stats: AccountLoader<'info, DriftStats>,
    #[account(
        mut,
        address = vault_state.drift_subaccount,
    )]
    pub drift_subaccount: AccountLoader<'info, DriftSubaccount>,

    #[account(
        mut,
        seeds = [
            b"spot_market_vault".as_ref(),
            0_u16.to_le_bytes().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_collateral_vault: Box<Account<'info, TokenAccount>>,
    pub drift_collateral_spot_market: AccountLoader<'info, SpotMarket>,
    pub drift_borrow_spot_market: AccountLoader<'info, SpotMarket>,

    /// CHECK: Drift CPI
    pub drift_quote_token_oracle: UncheckedAccount<'info>,

    pub drift_program: Program<'info, Drift>,
    pub token_program: Program<'info, Token>,
}

drift_withdraw_collateral_context_impl!(ClaimUserCollateralInterest);
