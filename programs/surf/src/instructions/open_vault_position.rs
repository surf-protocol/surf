use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::Token};
use whirlpools::{
    cpi::{self as whirlpool_cpi, accounts::OpenPosition as OpenWhirlpoolPosition},
    program::Whirlpool as WhirlpoolProgram,
    state::Whirlpool,
    OpenPositionBumps,
};

use crate::{
    errors::SurfError,
    state::{Vault, VaultPosition},
    utils::orca::tick_math::{get_initializable_tick_index, MAX_TICK_INDEX, MIN_TICK_INDEX},
};

pub fn handler(ctx: Context<OpenVaultPosition>, position_bump: u8) -> Result<()> {
    if ctx.accounts.vault.current_vault_position_id != None {
        return Err(SurfError::VaultPositionAlreadyOpen.into());
    }

    let full_tick_range = ctx.accounts.vault.full_tick_range;
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

    let vault = &mut ctx.accounts.vault;
    let vault_position_id = vault.vault_positions_count;
    let vault_position_bump = ctx.bumps.get("vault_position").unwrap();

    ctx.accounts.vault_position.open_new(
        *vault_position_bump,
        vault.key(),
        ctx.accounts.whirlpool_position.key(),
        vault_position_id,
        whirlpool.fee_growth_global_a,
        whirlpool.fee_growth_global_b,
        tick_upper_initializable,
        tick_lower_initializable,
        current_tick_index,
        vault.vault_tick_range,
    );

    vault.open_position(vault_position_id);

    Ok(())
}

#[derive(Accounts)]
#[instruction(position_bump: u8)]
pub struct OpenVaultPosition<'info> {
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
            vault.vault_positions_count.to_le_bytes().as_ref(),
        ],
        bump,
        payer = payer,
        space = VaultPosition::LEN,
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

impl<'info> OpenVaultPosition<'info> {
    pub fn open_whirlpool_position_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, OpenWhirlpoolPosition<'info>> {
        let accounts = OpenWhirlpoolPosition {
            funder: self.payer.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_mint: self.whirlpool_position_mint.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            owner: self.vault_position.to_account_info(),
            whirlpool: self.whirlpool.to_account_info(),
            token_program: self.token_program.to_account_info(),
            system_program: self.system_program.to_account_info(),
            rent: self.rent.to_account_info(),
            associated_token_program: self.associated_token_program.to_account_info(),
        };
        CpiContext::new(self.whirlpool_program.to_account_info(), accounts)
    }
}
