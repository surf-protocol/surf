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
    drift_deposit_borrow_context_impl,
    helpers::hedge::{sync_vault_borrow_interest_growth, update_user_borrow_interest},
    state::{HedgePosition, UserPosition, VaultState},
};

pub fn handler(ctx: Context<ClaimUserBorrowInterest>) -> Result<()> {
    // 1. validate user_position
    let mut hedge_position = ctx.accounts.vault_hedge_position.load_mut()?;
    let user_position = &mut ctx.accounts.user_position;

    require_eq!(user_position.hedge_position_id, hedge_position.id);
    require_eq!(
        user_position.borrow_position_index,
        hedge_position.current_borrow_position_index
    );

    // 2. update spot market interest and sync vault and user borrow interest
    drift_cpi::update_spot_market_cumulative_interest(CpiContext::new(
        ctx.accounts.drift_program.to_account_info(),
        UpdateSpotMarketCumulativeInterest {
            state: ctx.accounts.drift_state.to_account_info(),
            spot_market: ctx.accounts.drift_borrow_spot_market.to_account_info(),
            oracle: ctx.accounts.drift_base_token_oracle.to_account_info(),
        },
    ))?;

    let drift_subaccount = ctx.accounts.drift_subaccount.load()?;
    let borrow_spot_market = ctx.accounts.drift_borrow_spot_market.load()?;

    sync_vault_borrow_interest_growth(&mut hedge_position, &drift_subaccount, &borrow_spot_market)?;

    update_user_borrow_interest(user_position, &hedge_position.get_current_position())?;

    drop(user_position);

    // 3. transfer from user to vault
    let user_position = &ctx.accounts.user_position;
    let user_interest_claimable = user_position.borrow_interest_unclaimed;

    token_cpi::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_base_token_account.to_account_info(),
                to: ctx.accounts.vault_base_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        user_interest_claimable,
    )?;

    // 4. repay to drift
    drift_cpi::deposit(
        ctx.accounts.drift_deposit_borrow_context(),
        1_u16,
        user_interest_claimable,
        true,
    )?;

    // 5. update program accounts
    hedge_position.claim_user_borrow_interest(user_interest_claimable)?;
    ctx.accounts.user_position.claim_borrow_interest();

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimUserBorrowInterest<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        token::mint = vault_state.base_token_mint,
        token::authority = owner,
    )]
    pub owner_base_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [
            UserPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(
        constraint = vault_state.hedge_positions_count > 0,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,

    #[account(
        mut,
        address = vault_state.base_token_mint,
    )]
    pub vault_base_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [
            HedgePosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.current_hedge_position_id.unwrap().to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub vault_hedge_position: AccountLoader<'info, HedgePosition>,

    pub drift_state: Box<Account<'info, DriftState>>,
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
            1_u16.to_le_bytes().as_ref(),
        ],
        bump,
        seeds::program = drift_program.key(),
    )]
    pub drift_borrow_vault: Box<Account<'info, TokenAccount>>,
    pub drift_borrow_spot_market: AccountLoader<'info, SpotMarket>,
    /// CHECK: Drift CPI
    pub drift_base_token_oracle: UncheckedAccount<'info>,

    pub drift_program: Program<'info, Drift>,
    pub token_program: Program<'info, Token>,
}

drift_deposit_borrow_context_impl!(ClaimUserBorrowInterest);
