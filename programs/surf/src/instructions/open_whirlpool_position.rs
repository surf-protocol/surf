use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::Token};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::OpenPosition},
    program::Whirlpool as WhirlpoolProgram,
    state::Whirlpool,
    OpenPositionBumps,
};

use crate::{
    errors::SurfError,
    state::{Vault, VaultPosition},
    utils::tick_math::{get_initializable_tick_index, MAX_TICK_INDEX, MIN_TICK_INDEX},
};

pub fn handler(
    ctx: Context<OpenWhirlpoolPosition>,
    position_bump: u8,
    // Tick indexes without accounting for tick spacing
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> Result<()> {
    // Check ticks validity
    if tick_upper_index <= tick_lower_index {
        return Err(SurfError::InvalidTickIndexes.into());
    }
    if tick_upper_index > MAX_TICK_INDEX || tick_lower_index < MIN_TICK_INDEX {
        return Err(SurfError::TickIndexOverflow.into());
    }

    // Check range
    let full_tick_range = ctx.accounts.vault.full_tick_range;
    let provided_range = (tick_upper_index - tick_lower_index).abs() as u32;

    if provided_range != full_tick_range {
        return Err(SurfError::InvalidProvidedTickRange.into());
    }

    // Check if current tick is in the middle of full range
    let current_tick_index = ctx.accounts.whirlpool.tick_current_index;
    let half_range = full_tick_range as i32 / 2 - 5;

    if current_tick_index + half_range > tick_upper_index
        || current_tick_index - half_range < tick_lower_index
    {
        return Err(SurfError::CurrentTickIndexShiftedFromMidRange.into());
    }

    // Create position
    let tick_spacing = ctx.accounts.whirlpool.tick_spacing;
    let tick_upper_initializable = get_initializable_tick_index(tick_upper_index, tick_spacing);
    let tick_lower_initializable = get_initializable_tick_index(tick_lower_index, tick_spacing);

    let whirlpool_cpi = ctx.accounts.get_open_whirlpool_position_context();
    whirlpool_cpi::open_position(
        whirlpool_cpi,
        OpenPositionBumps { position_bump },
        tick_lower_initializable,
        tick_upper_initializable,
    )?;

    let vault_position_bump = ctx.bumps.get("vault_position").unwrap();
    ctx.accounts.vault_position.initialize(
        *vault_position_bump,
        ctx.accounts.whirlpool_position.key(),
        ctx.accounts.vault.vault_tick_range,
        current_tick_index,
    );

    Ok(())
}

#[derive(Accounts)]
#[instruction(position_bump: u8)]
pub struct OpenWhirlpoolPosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(mut,
        seeds = [
            Vault::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        bump = vault.bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    #[account(init,
        seeds = [
            VaultPosition::NAMESPACE.as_ref(),
            vault.key().as_ref(),
        ],
        bump,
        payer = payer,
        space = VaultPosition::LEN
    )]
    pub vault_position: Account<'info, VaultPosition>,

    /// CHECK: Whirlpool program handles checks
    #[account(mut,
        seeds = [
            b"position".as_ref(),
            whirlpool_position_mint.key().as_ref(),
        ],
        bump = position_bump,
        seeds::program = whirlpool_program.key()
    )]
    pub whirlpool_position: UncheckedAccount<'info>,

    /// CHECK: Whirlpool program handles checks
    #[account(mut)]
    pub whirlpool_position_mint: Signer<'info>,

    /// CHECK: Whirlpool program handles checks
    #[account(mut)]
    pub whirlpool_position_token_account: UncheckedAccount<'info>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> OpenWhirlpoolPosition<'info> {
    pub fn get_open_whirlpool_position_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, OpenPosition<'info>> {
        let accounts = OpenPosition {
            funder: self.payer.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_mint: self.whirlpool_position_mint.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            owner: self.vault.to_account_info(),
            whirlpool: self.whirlpool.to_account_info(),
            token_program: self.token_program.to_account_info(),
            system_program: self.system_program.to_account_info(),
            rent: self.rent.to_account_info(),
            associated_token_program: self.associated_token_program.to_account_info(),
        };
        CpiContext::new(self.whirlpool_program.to_account_info(), accounts)
    }
}
