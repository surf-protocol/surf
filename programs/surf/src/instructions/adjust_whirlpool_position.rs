use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use whirlpools::{
    cpi::{
        self as whirlpool_cpi,
        accounts::{CollectFees, DecreaseLiquidity, IncreaseLiquidity, OpenPosition, Swap},
    },
    program::Whirlpool as WhirlpoolProgram,
    state::Position as WhirlpoolPosition,
    OpenPositionBumps, TickArray, Whirlpool,
};
use whirlpools_client::math::{MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64};

use crate::{
    errors::SurfError,
    helpers::{
        hedge::get_notional_amount_diff,
        whirlpool::{
            sync_vault_whirlpool_position, transfer_whirlpool_fees_and_rewards_to_vault,
            CollectWhirlpoolFeesAndRewardsContext,
        },
    },
    state::{VaultState, WhirlpoolAdjustmentState, WhirlpoolPosition as VaultWhirlpoolPosition},
    utils::{
        orca::liquidity_math::{
            get_amount_delta_a_wrapped, get_amount_delta_b_wrapped, get_liquidity_from_base_token,
            get_liquidity_from_quote_token, get_whirlpool_tokens_deltas,
        },
        tick_range::{calculate_whirlpool_and_inner_bounds, validate_bounds},
    },
};

pub fn withdraw_liquidity(ctx: &Context<AdjustWhirlpoolPosition>) -> Result<()> {
    let vault_whirlpool_position = &ctx.accounts.vault_whirlpool_position;

    let (current_base_token_amount, current_quote_token_amount) = get_whirlpool_tokens_deltas(
        vault_whirlpool_position.liquidity,
        ctx.accounts.whirlpool.sqrt_price,
        vault_whirlpool_position.upper_sqrt_price,
        vault_whirlpool_position.lower_sqrt_price,
        false,
    )?;

    whirlpool_cpi::decrease_liquidity(
        ctx.accounts.decrease_liquidity_context(),
        vault_whirlpool_position.liquidity,
        current_base_token_amount,
        current_quote_token_amount,
    )?;

    Ok(())
}

pub fn get_base_token_diff<'info>(
    base_token_account: &mut Account<'info, TokenAccount>,
) -> Result<u64> {
    let pre_amount = base_token_account.amount;
    base_token_account.reload()?;
    let post_amount = base_token_account.amount;

    Ok(pre_amount - post_amount)
}

pub struct NextAmounts {
    liquidity: u128,
    base_token: u64,
    quote_token: u64,
}

pub fn handler(ctx: Context<AdjustWhirlpoolPosition>, next_position_bump: u8) -> Result<()> {
    let whirlpool = &mut ctx.accounts.whirlpool;
    let vault_whirlpool_position = &mut ctx.accounts.vault_whirlpool_position;

    let current_sqrt_price = whirlpool.sqrt_price;
    let upper_sqrt_price_boundary = vault_whirlpool_position.inner_upper_sqrt_price;
    let lower_sqrt_price_boundary = vault_whirlpool_position.inner_lower_sqrt_price;

    require!(
        current_sqrt_price > upper_sqrt_price_boundary
            || current_sqrt_price < lower_sqrt_price_boundary,
        SurfError::SqrtPriceNotOutOfBounds,
    );

    sync_vault_whirlpool_position(
        vault_whirlpool_position,
        whirlpool,
        &ctx.accounts.whirlpool_position,
        &ctx.accounts.position_tick_array_lower,
        &ctx.accounts.position_tick_array_upper,
        &ctx.accounts.whirlpool_program,
    )?;
    drop(vault_whirlpool_position);
    drop(whirlpool);
    transfer_whirlpool_fees_and_rewards_to_vault(&ctx)?;
    withdraw_liquidity(&ctx)?;

    let whirlpool = &ctx.accounts.whirlpool;
    let vault_state = &ctx.accounts.vault_state;
    let vault_whirlpool_position = &ctx.accounts.vault_whirlpool_position;

    let (current_base_token_amount, current_quote_token_amount) = get_whirlpool_tokens_deltas(
        vault_whirlpool_position.liquidity,
        vault_whirlpool_position.middle_sqrt_price,
        vault_whirlpool_position.upper_sqrt_price,
        vault_whirlpool_position.lower_sqrt_price,
        false,
    )?;
    let (next_whirlpool_bounds, next_inner_bounds, next_middle_sqrt_price) =
        calculate_whirlpool_and_inner_bounds(vault_state, whirlpool);

    validate_bounds(&next_whirlpool_bounds, &next_inner_bounds)?;

    let (next_amounts, next_adjustment_state): (NextAmounts, WhirlpoolAdjustmentState) =
        if current_sqrt_price > upper_sqrt_price_boundary {
            let estimated_liq = get_liquidity_from_quote_token(
                current_quote_token_amount,
                next_whirlpool_bounds.lower_sqrt_price,
                whirlpool.sqrt_price,
                false,
            );
            let estimated_base_token_amount = get_amount_delta_a_wrapped(
                whirlpool.sqrt_price,
                next_whirlpool_bounds.upper_sqrt_price,
                estimated_liq,
                true,
            )?;

            let base_token_diff = estimated_base_token_amount - current_base_token_amount;
            ctx.accounts.vault_quote_token_account.reload()?;

            // 2. swap to estimated amounts
            whirlpool_cpi::swap(
                ctx.accounts.swap_context(),
                base_token_diff,
                u64::MAX,
                MAX_SQRT_PRICE_X64,
                false,
                false,
            )?;

            let quote_token_diff =
                get_notional_amount_diff(&mut ctx.accounts.vault_quote_token_account, false)?
                    .unsigned_abs();

            let new_sqrt_price = if ctx.accounts.swap_whirlpool.key().eq(&whirlpool.key()) {
                ctx.accounts.whirlpool.reload()?;
                ctx.accounts.whirlpool.sqrt_price
            } else {
                whirlpool.sqrt_price
            };

            // 3. get real amounts
            let real_quote_token_amount = current_quote_token_amount - quote_token_diff;
            let real_liq = get_liquidity_from_quote_token(
                real_quote_token_amount,
                next_whirlpool_bounds.lower_sqrt_price,
                next_whirlpool_bounds.upper_sqrt_price,
                false,
            );
            let real_base_token_amount = get_amount_delta_a_wrapped(
                new_sqrt_price,
                next_whirlpool_bounds.upper_sqrt_price,
                real_liq,
                true,
            )?;

            (
                NextAmounts {
                    liquidity: real_liq,
                    base_token: real_base_token_amount,
                    quote_token: real_quote_token_amount,
                },
                WhirlpoolAdjustmentState::Above,
            )
        } else {
            // Adjust below
            // swapping base to quote, price will move DOWN
            let estimated_liq = get_liquidity_from_base_token(
                current_base_token_amount,
                whirlpool.sqrt_price,
                vault_whirlpool_position.upper_sqrt_price,
                false,
            )?;
            let estimated_quote_token_amount = get_amount_delta_b_wrapped(
                whirlpool.sqrt_price,
                next_whirlpool_bounds.lower_sqrt_price,
                estimated_liq,
                true,
            )?;

            let quote_token_diff = estimated_quote_token_amount - current_quote_token_amount;

            ctx.accounts.vault_base_token_account.reload()?;

            whirlpool_cpi::swap(
                ctx.accounts.swap_context(),
                quote_token_diff,
                u64::MAX,
                MIN_SQRT_PRICE_X64,
                false,
                true,
            )?;

            let base_token_dif = get_base_token_diff(&mut ctx.accounts.vault_base_token_account)?;

            let new_sqrt_price = if ctx.accounts.swap_whirlpool.key().eq(&whirlpool.key()) {
                ctx.accounts.whirlpool.reload()?;
                ctx.accounts.whirlpool.sqrt_price
            } else {
                whirlpool.sqrt_price
            };

            let real_base_token_amount = current_base_token_amount - base_token_dif;
            let real_liq = get_liquidity_from_base_token(
                real_base_token_amount,
                new_sqrt_price,
                next_whirlpool_bounds.upper_sqrt_price,
                false,
            )?;
            let real_quote_token_amount = get_amount_delta_b_wrapped(
                next_whirlpool_bounds.lower_sqrt_price,
                new_sqrt_price,
                real_liq,
                true,
            )?;

            (
                NextAmounts {
                    liquidity: real_liq,
                    base_token: real_base_token_amount,
                    quote_token: real_quote_token_amount,
                },
                WhirlpoolAdjustmentState::Below,
            )
        };

    whirlpool_cpi::open_position(
        ctx.accounts.open_next_whirlpool_position_context(),
        OpenPositionBumps {
            position_bump: next_position_bump,
        },
        next_whirlpool_bounds.upper_tick_index,
        next_whirlpool_bounds.lower_tick_index,
    )?;

    whirlpool_cpi::increase_liquidity(
        ctx.accounts.increase_liquidity_context(),
        next_amounts.liquidity,
        next_amounts.base_token,
        next_amounts.quote_token,
    )?;

    let liquidity_diff =
        (vault_whirlpool_position.liquidity_diff as i128) - (next_amounts.liquidity as i128);

    let whirlpool = &ctx.accounts.whirlpool;
    let next_vault_whirlpool_position_bump =
        *ctx.bumps.get("next_vault_whirlpool_position").unwrap();

    ctx.accounts
        .vault_whirlpool_position
        .update_liquidity_diff(liquidity_diff);

    ctx.accounts.next_vault_whirlpool_position.open(
        next_vault_whirlpool_position_bump,
        vault_state.key(),
        vault_state.whirlpool_positions_count,
        ctx.accounts.next_whirlpool_position.key(),
        next_amounts.liquidity,
        whirlpool.fee_growth_global_a,
        whirlpool.fee_growth_global_b,
        next_whirlpool_bounds.upper_sqrt_price,
        next_whirlpool_bounds.lower_sqrt_price,
        next_middle_sqrt_price,
        next_inner_bounds.upper_sqrt_price,
        next_inner_bounds.lower_sqrt_price,
    );

    ctx.accounts.vault_state.open_whirlpool_position()?;
    ctx.accounts
        .vault_state
        .update_whirlpool_adjustment_state(next_adjustment_state);

    // TODO: save unused token amounts

    Ok(())
}

#[derive(Accounts)]
pub struct AdjustWhirlpoolPosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [
            VaultState::NAMESPACE.as_ref(),
            whirlpool.key().as_ref(),
        ],
        bump = vault_state.bump,
        constraint = vault_state.current_whirlpool_position_id != None,
    )]
    pub vault_state: Box<Account<'info, VaultState>>,
    #[account(
        mut,
        address = vault_state.base_token_account,
    )]
    pub vault_base_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = vault_state.quote_token_account,
    )]
    pub vault_quote_token_account: Box<Account<'info, TokenAccount>>,

    // ------------
    // CURRENT WHIRLPOOL POSITION ACCOUNTS
    #[account(
        mut,
        seeds = [
            VaultWhirlpoolPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.current_whirlpool_position_id.unwrap().to_le_bytes().as_ref(),
        ],
        bump = vault_whirlpool_position.bump,
    )]
    pub vault_whirlpool_position: Box<Account<'info, VaultWhirlpoolPosition>>,

    #[account(
        mut,
        address = vault_whirlpool_position.whirlpool_position,
    )]
    pub whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,
    pub whirlpool_position_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub position_tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub position_tick_array_upper: AccountLoader<'info, TickArray>,

    // ------------
    // NEXT WHIRLPOOL POSITION ACCOUNTS
    #[account(
        init,
        payer = payer,
        space = VaultWhirlpoolPosition::LEN,
        seeds = [
            VaultWhirlpoolPosition::NAMESPACE.as_ref(),
            vault_state.key().as_ref(),
            vault_state.whirlpool_positions_count.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub next_vault_whirlpool_position: Box<Account<'info, VaultWhirlpoolPosition>>,

    #[account(
        mut,
        address = vault_whirlpool_position.whirlpool_position,
    )]
    pub next_whirlpool_position: Box<Account<'info, WhirlpoolPosition>>,
    #[account(mut)]
    pub next_whirlpool_position_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub next_whirlpool_position_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub next_position_tick_array_lower: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub next_position_tick_array_upper: AccountLoader<'info, TickArray>,

    #[account(mut)]
    pub whirlpool: Box<Account<'info, Whirlpool>>,

    #[account(
        mut,
        address = whirlpool.token_vault_a,
    )]
    pub whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = whirlpool.token_vault_b,
    )]
    pub whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

    // -----------
    // WHIRLPOOL POSITION ADJUSTMENT SWAP ACCOUNTS
    #[account(mut)]
    pub swap_whirlpool: Box<Account<'info, Whirlpool>>,
    #[account(
        mut,
        address = swap_whirlpool.token_vault_a,
    )]
    pub swap_whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        address = swap_whirlpool.token_vault_b,
    )]
    pub swap_whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,
    pub swap_whirlpool_oracle: UncheckedAccount<'info>,

    #[account(mut)]
    pub swap_tick_array_0: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub swap_tick_array_1: AccountLoader<'info, TickArray>,
    #[account(mut)]
    pub swap_tick_array_2: AccountLoader<'info, TickArray>,

    pub whirlpool_program: Program<'info, WhirlpoolProgram>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> AdjustWhirlpoolPosition<'info> {
    pub fn decrease_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, DecreaseLiquidity<'info>> {
        let program = &self.whirlpool_program;
        let accounts = DecreaseLiquidity {
            whirlpool: self.whirlpool.to_account_info(),
            token_vault_a: self.whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self.whirlpool_quote_token_vault.to_account_info(),
            tick_array_lower: self.position_tick_array_lower.to_account_info(),
            tick_array_upper: self.position_tick_array_upper.to_account_info(),
            position_authority: self.vault_whirlpool_position.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }

    pub fn swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
        let program = &self.whirlpool_program;
        let accounts = Swap {
            whirlpool: self.swap_whirlpool.to_account_info(),
            token_vault_a: self.swap_whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self.swap_whirlpool_quote_token_vault.to_account_info(),
            token_authority: self.vault_state.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            tick_array0: self.swap_tick_array_0.to_account_info(),
            tick_array1: self.swap_tick_array_1.to_account_info(),
            tick_array2: self.swap_tick_array_2.to_account_info(),
            oracle: self.swap_whirlpool_oracle.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }

    pub fn open_next_whirlpool_position_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, OpenPosition<'info>> {
        let program = &self.whirlpool_program;
        let accounts = OpenPosition {
            funder: self.payer.to_account_info(),
            owner: self.vault_state.to_account_info(),
            whirlpool: self.whirlpool.to_account_info(),
            position: self.next_whirlpool_position.to_account_info(),
            position_mint: self.next_whirlpool_position_mint.to_account_info(),
            position_token_account: self.next_whirlpool_position_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
            system_program: self.system_program.to_account_info(),
            associated_token_program: self.associated_token_program.to_account_info(),
            rent: self.rent.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }

    pub fn increase_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, IncreaseLiquidity<'info>> {
        let program = &self.whirlpool_program;
        let accounts = IncreaseLiquidity {
            whirlpool: self.whirlpool.to_account_info(),
            token_vault_a: self.whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self.whirlpool_quote_token_vault.to_account_info(),
            position: self.next_whirlpool_position.to_account_info(),
            position_token_account: self.next_whirlpool_position_token_account.to_account_info(),
            position_authority: self.vault_state.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            tick_array_lower: self.next_position_tick_array_lower.to_account_info(),
            tick_array_upper: self.next_position_tick_array_upper.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}

impl<'info> CollectWhirlpoolFeesAndRewardsContext<'info> for AdjustWhirlpoolPosition<'info> {
    fn collect_whirlpool_fees_and_rewards_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, CollectFees<'info>> {
        let program = &self.whirlpool_program;
        let accounts = CollectFees {
            whirlpool: self.whirlpool.to_account_info(),
            token_vault_a: self.whirlpool_base_token_vault.to_account_info(),
            token_vault_b: self.whirlpool_quote_token_vault.to_account_info(),
            position: self.whirlpool_position.to_account_info(),
            position_token_account: self.whirlpool_position_token_account.to_account_info(),
            position_authority: self.vault_state.to_account_info(),
            token_owner_account_a: self.vault_base_token_account.to_account_info(),
            token_owner_account_b: self.vault_quote_token_account.to_account_info(),
            token_program: self.token_program.to_account_info(),
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}
