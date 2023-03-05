use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::Token};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::OpenPosition},
    program::Whirlpool as WhirlpoolProgram,
    OpenPositionBumps, Whirlpool,
};

use crate::{
    errors::SurfError,
    state::{VaultState, WhirlpoolPosition},
    utils::tick_range::{calculate_whirlpool_and_inner_bounds, validate_bounds},
};

pub fn handler(ctx: Context<OpenWhirlpoolPosition>, position_bump: u8) -> Result<()> {
    // Open only if no position was opened yet
    // TODO: Add error
    require_eq!(ctx.accounts.vault_state.whirlpool_positions_count, 0);

    let vault_state = &ctx.accounts.vault_state;

    let whirlpool = &ctx.accounts.whirlpool;

    let (whirlpool_range_bounds, inner_range_bounds, middle_sqrt_price) =
        calculate_whirlpool_and_inner_bounds(vault_state, whirlpool);

    validate_bounds(&whirlpool_range_bounds, &inner_range_bounds)?;

    whirlpool_cpi::open_position(
        ctx.accounts.open_whirlpool_position_context(),
        OpenPositionBumps { position_bump },
        whirlpool_range_bounds.lower_tick_index,
        whirlpool_range_bounds.upper_tick_index,
    )?;

    let vault_whirlpool_position_bump = *ctx.bumps.get("vault_whirlpool_position").unwrap();

    ctx.accounts.vault_whirlpool_position.open(
        vault_whirlpool_position_bump,
        vault_state.key(),
        vault_state.whirlpool_positions_count,
        ctx.accounts.whirlpool_position.key(),
        0,
        whirlpool.fee_growth_global_a,
        whirlpool.fee_growth_global_b,
        whirlpool_range_bounds.upper_sqrt_price,
        whirlpool_range_bounds.lower_sqrt_price,
        middle_sqrt_price,
        inner_range_bounds.upper_sqrt_price,
        inner_range_bounds.lower_sqrt_price,
    );

    ctx.accounts.vault_state.open_whirlpool_position()?;

    Ok(())
}

#[derive(Accounts)]
pub struct OpenWhirlpoolPosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            VaultState::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        bump = vault_state.bump,
        constraint = vault_state.current_whirlpool_position_id == None @SurfError::VaultPositionAlreadyOpen,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = payer,
        space = WhirlpoolPosition::LEN,
        seeds = [
            WhirlpoolPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.whirlpool_positions_count.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub vault_whirlpool_position: Account<'info, WhirlpoolPosition>,

    // -------------
    // WHIRLPOOL ACCOUNTS
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    /// CHECK: Whirlpool program handles checks
    #[account(mut)]
    pub whirlpool_position: UncheckedAccount<'info>,
    #[account(mut)]
    pub whirlpool_position_mint: Signer<'info>,
    /// CHECK: Whirlpool program handles checks
    #[account(mut)]
    pub whirlpool_position_token_account: UncheckedAccount<'info>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> OpenWhirlpoolPosition<'info> {
    pub fn open_whirlpool_position_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, OpenPosition<'info>> {
        let program = &self.whirlpool_program;
        let accounts = OpenPosition {
            funder: self.payer.to_account_info(),
            owner: self.vault_state.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_mint: self.whirlpool_position_mint.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            whirlpool: self.whirlpool.to_account_info(),
            system_program: self.system_program.to_account_info(),
            token_program: self.token_program.to_account_info(),
            associated_token_program: self.associated_token_program.to_account_info(),
            rent: self.rent.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}
