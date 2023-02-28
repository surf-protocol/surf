use anchor_lang::prelude::*;
use whirlpools::{
    cpi::{
        self as whirlpool_cpi,
        accounts::{CollectFees, UpdateFeesAndRewards},
    },
    program::Whirlpool as WhirlpoolProgram,
    Position as WhirlpoolPosition, TickArray, Whirlpool,
};
use whirlpools_client::math::{checked_mul_shift_right, U256Muldiv};

use crate::{
    errors::SurfError,
    state::{UserPosition, WhirlpoolPosition as VaultWhirlpoolPosition},
};

pub fn sync_vault_whirlpool_position<'info>(
    vault_whirlpool_position: &mut Account<'info, VaultWhirlpoolPosition>,
    whirlpool: &mut Account<'info, Whirlpool>,
    whirlpool_position: &Account<'info, WhirlpoolPosition>,
    tick_array_lower: &AccountLoader<'info, TickArray>,
    tick_array_upper: &AccountLoader<'info, TickArray>,
    whirlpool_program: &Program<'info, WhirlpoolProgram>,
) -> Result<()> {
    whirlpool_cpi::update_fees_and_rewards(CpiContext::new(
        whirlpool_program.to_account_info(),
        UpdateFeesAndRewards {
            whirlpool: whirlpool.to_account_info(),
            position: whirlpool_position.to_account_info(),
            tick_array_lower: tick_array_lower.to_account_info(),
            tick_array_upper: tick_array_upper.to_account_info(),
        },
    ))?;

    whirlpool.reload()?;

    vault_whirlpool_position.base_token_fee_growth = whirlpool.fee_growth_global_a;
    vault_whirlpool_position.quote_token_fee_growth = whirlpool.fee_growth_global_b;

    Ok(())
}

pub trait CollectWhirlpoolFeesAndRewardsContext<'info> {
    fn collect_whirlpool_fees_and_rewards_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, CollectFees<'info>>;
}

pub fn transfer_whirlpool_fees_and_rewards_to_vault<
    'info,
    T: CollectWhirlpoolFeesAndRewardsContext<'info>,
>(
    ctx: &Context<T>,
) -> Result<()> {
    whirlpool_cpi::collect_fees(ctx.accounts.collect_whirlpool_fees_and_rewards_context())

    // TODO: Collect rewards if needed
}

pub fn update_user_fees_and_rewards<'info>(
    user_position: &mut Account<'info, UserPosition>,
    whirlpool_position: &Account<'info, VaultWhirlpoolPosition>,
) -> () {
    let current_base_growth = whirlpool_position.base_token_fee_growth;
    let current_quote_growth = whirlpool_position.quote_token_fee_growth;

    if user_position.liquidity > 0 {
        // The following code is referenced from orca-so whirlpools program
        // https://github.com/orca-so/whirlpools/blob/0.8.0/programs/whirlpool/src/manager/position_manager.rs#L16
        let delta_base_token_per_unit =
            current_base_growth.wrapping_sub(user_position.fee_growth_checkpoint_base_token);
        let delta_quote_token_per_unit =
            current_quote_growth.wrapping_sub(user_position.fee_growth_checkpoint_quote_token);

        let delta_base_token =
            checked_mul_shift_right(delta_base_token_per_unit, user_position.liquidity)
                .unwrap_or(0);
        let delta_quote_token =
            checked_mul_shift_right(delta_quote_token_per_unit, user_position.liquidity)
                .unwrap_or(0);

        user_position.fee_unclaimed_base_token = delta_base_token;
        user_position.fee_unclaimed_quote_token = delta_quote_token;
    }

    user_position.fee_growth_checkpoint_base_token = current_base_growth;
    user_position.fee_growth_checkpoint_quote_token = current_quote_growth;
}

pub fn update_user_liquidity<'info>(
    user_position: &mut Account<'info, UserPosition>,
    whirlpool_position: &Account<'info, VaultWhirlpoolPosition>,
) -> Result<()> {
    let global_liquidity = whirlpool_position.liquidity;
    let global_liquidity_diff = whirlpool_position.liquidity_diff;

    if global_liquidity_diff == 0 {
        return Ok(());
    }

    let is_negative = global_liquidity_diff < 0;
    let global_liquidity_diff_abs = global_liquidity_diff.unsigned_abs();

    let new_global_liquidity = if is_negative {
        global_liquidity
            .checked_sub(global_liquidity_diff_abs)
            .ok_or(SurfError::LiquidityDiffTooHigh)?
    } else {
        global_liquidity
            .checked_add(global_liquidity_diff_abs)
            .ok_or(SurfError::LiquidityDiffTooHigh)?
    };

    let user_liquidity_u256 = U256Muldiv::new(0, user_position.liquidity);
    let current_global_liquidity_u256 = U256Muldiv::new(0, global_liquidity);
    let new_vault_liquidity_u256 = U256Muldiv::new(0, new_global_liquidity);

    let new_user_liquidity_u256 = user_liquidity_u256
        .mul(new_vault_liquidity_u256)
        .div(current_global_liquidity_u256, false);

    let new_user_liquidity = new_user_liquidity_u256.0.try_into_u128();

    if let Err(_) = new_user_liquidity {
        return Err(SurfError::LiquidityDiffTooHigh.into());
    }

    user_position.liquidity = new_user_liquidity.unwrap();

    Ok(())
}
