use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::Token};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::OpenPosition},
    program::Whirlpool as WhirlpoolProgram,
    OpenPositionBumps, Whirlpool,
};
use whirlpools_client::math::sqrt_price_from_tick_index;

use crate::{
    errors::SurfError,
    state::{AdminConfig, VaultState, WhirlpoolPosition},
    utils::{
        constraints::is_admin,
        orca::tick_math::{get_initializable_tick_index, MAX_TICK_INDEX, MIN_TICK_INDEX},
    },
};

pub fn handler(ctx: Context<OpenWhirlpoolPosition>, position_bump: u8) -> Result<()> {
    let full_tick_range = ctx.accounts.vault_state.full_tick_range;
    let one_side_tick_range = (full_tick_range / 2) as i32;

    let whirlpool = &ctx.accounts.whirlpool;
    let current_tick_index = whirlpool.tick_current_index;
    let tick_upper_index = current_tick_index + one_side_tick_range;
    let tick_lower_index = current_tick_index - one_side_tick_range;

    let tick_spacing = whirlpool.tick_spacing;
    let tick_upper_initializable = get_initializable_tick_index(tick_upper_index, tick_spacing);
    let tick_lower_initializable = get_initializable_tick_index(tick_lower_index, tick_spacing);

    if tick_upper_initializable > MAX_TICK_INDEX {
        return Err(SurfError::UpperTickIndexOutOfBounds.into());
    }
    if tick_lower_initializable < MIN_TICK_INDEX {
        return Err(SurfError::LowerTickIndexOutOfBounds.into());
    }

    whirlpool_cpi::open_position(
        ctx.accounts.open_whirlpool_position_context(),
        OpenPositionBumps { position_bump },
        tick_lower_initializable,
        tick_upper_initializable,
    )?;

    let vault_whirlpool_position_bump = *ctx.bumps.get("vault_whirlpool_position").unwrap();
    let vault_state = &mut ctx.accounts.vault_state;
    let whirlpool = &ctx.accounts.whirlpool;

    let middle_tick_index = (tick_upper_initializable + tick_lower_initializable) / 2;
    let middle_sqrt_price = sqrt_price_from_tick_index(middle_tick_index);
    let upper_sqrt_price = sqrt_price_from_tick_index(tick_upper_initializable);
    let lower_sqrt_price = sqrt_price_from_tick_index(tick_lower_initializable);

    ctx.accounts.vault_whirlpool_position.open(
        vault_whirlpool_position_bump,
        vault_state.key(),
        vault_state.whirlpool_positions_count,
        ctx.accounts.whirlpool_position.key(),
        0,
        whirlpool.fee_growth_global_a,
        whirlpool.fee_growth_global_b,
        upper_sqrt_price,
        lower_sqrt_price,
        middle_sqrt_price,
    );

    vault_state.current_whirlpool_position_id = Some(vault_state.whirlpool_positions_count);

    Ok(())
}

#[derive(Accounts)]
pub struct OpenWhirlpoolPosition<'info> {
    #[account(
        mut,
        constraint = is_admin(&admin_config, &admin) @SurfError::InvalidAdmin,
    )]
    pub admin: Signer<'info>,
    #[account(
        seeds = [
            AdminConfig::NAMESPACE.as_ref(),
        ],
        bump = admin_config.bump,
    )]
    pub admin_config: Account<'info, AdminConfig>,

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
        payer = admin,
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
    pub whirlpool_position: UncheckedAccount<'info>,
    /// CHECK: Whirlpool program handles checks
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
            funder: self.admin.to_account_info(),
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
