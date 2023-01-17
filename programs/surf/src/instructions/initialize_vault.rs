use anchor_lang::{prelude::*, solana_program::entrypoint::ProgramResult};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use drift::cpi as drift_cpi;
use whirlpools::{
    cpi as whirlpool_cpi, cpi::accounts::OpenPosition, program::Whirlpool as WhirlpoolProgram,
    OpenPositionBumps, Whirlpool,
};

use crate::state::Vault;

pub fn handler(
    ctx: Context<InitializeVault>,
    position_bump: u8,
    tick_lower_index: i32,
    tick_upper_index: i32,
) -> ProgramResult {
    let vault_account = &mut ctx.accounts.vault;

    vault_account.set_inner(Vault {
        whirlpool: ctx.accounts.whirlpool.key(),
        whirlpool_position: ctx.accounts.position.key(),
        token_mint_a: ctx.accounts.token_mint_a.key(),
        token_mint_b: ctx.accounts.token_mint_b.key(),
        token_vault_a: ctx.accounts.token_vault_a.key(),
        token_vault_b: ctx.accounts.token_vault_b.key(),
    });

    let whirlpool_program = ctx.accounts.whirlpool_program.to_account_info();
    let open_position_accounts = OpenPosition {
        owner: vault_account.to_account_info(),
        funder: ctx.accounts.funder.to_account_info(),
        position_mint: ctx.accounts.position_mint.to_account_info(),
        position: ctx.accounts.position.to_account_info(),
        position_token_account: ctx.accounts.position_token_account.to_account_info(),
        whirlpool: ctx.accounts.whirlpool.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        rent: ctx.accounts.rent.to_account_info(),
    };

    whirlpool_cpi::open_position(
        CpiContext::new(whirlpool_program, open_position_accounts),
        OpenPositionBumps { position_bump },
        tick_lower_index,
        tick_upper_index,
    )?;

    // drift_cpi::initialize_user_stats()

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,

    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(init,
        seeds = [
            b"vault".as_ref(),
            whirlpool.key().as_ref(),
        ],
        payer = funder,
        space = Vault::LEN,
        bump
    )]
    pub vault: Box<Account<'info, Vault>>,

    /// CHECK: Whirlpool program handles checks
    #[account(mut)]
    pub position: UncheckedAccount<'info>,
    /// CHECK: Whirlpool program handles checks
    #[account(mut)]
    pub position_mint: Signer<'info>,
    /// CHECK: Whirlpool program handles checks
    #[account(mut)]
    pub position_token_account: UncheckedAccount<'info>,

    pub token_mint_a: Account<'info, Mint>,
    #[account(init,
        payer = funder,
        associated_token::mint = token_mint_a,
        associated_token::authority = vault
    )]
    pub token_vault_a: Account<'info, TokenAccount>,

    pub token_mint_b: Account<'info, Mint>,
    #[account(init,
        payer = funder,
        associated_token::mint = token_mint_b,
        associated_token::authority = vault
    )]
    pub token_vault_b: Account<'info, TokenAccount>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
