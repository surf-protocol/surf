use anchor_lang::prelude::*;

use crate::state::UserPosition;

pub fn handler(ctx: Context<CloseUserPosition>) -> Result<()> {
    let user_position = &ctx.accounts.user_position;

    require_eq!(user_position.liquidity, 0);
    require_eq!(user_position.borrow_amount, 0);
    require_eq!(user_position.collateral_amount, 0);

    Ok(())
}

#[derive(Accounts)]
pub struct CloseUserPosition<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
    )]
    pub user_position: Account<'info, UserPosition>,
}
