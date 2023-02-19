// use anchor_lang::prelude::*;
// use anchor_spl::token::{Token, TokenAccount};
// use drift::{
//     cpi::{
//         self as drift_cpi,
//         accounts::{Deposit as DriftDeposit, Withdraw as DriftWithdraw},
//     },
//     program::Drift,
//     state::{
//         spot_market::SpotMarket as DriftSpotMarket,
//         state::State as DriftState,
//         user::{User as DriftSubaccount, UserStats as DriftStats},
//     },
// };
// use whirlpools::{
//     cpi::{self as whirlpool_cpi, accounts::Swap},
//     program::Whirlpool as WhirlpoolProgram,
//     TickArray, Whirlpool,
// };
// use whirlpools_client::math::MAX_SQRT_PRICE_X64;

// use crate::{
//     errors::SurfError,
//     state::{vault_position, Vault, VaultPosition},
//     utils::orca::liquidity_math::get_amount_delta_a_wrapped,
// };

// pub fn validate_hedge<'info>(vault_position: &Account<'info, VaultPosition>) -> Result<()> {
//     if None == vault_position.last_hedge_adjustment_tick_index {
//         return Err(SurfError::VaultPositionNotHedged.into());
//     }

//     Ok(())
// }

// pub fn get_notional_diff<'info>(
//     quote_token_account: &mut Account<'info, TokenAccount>,
// ) -> Result<i64> {
//     let pre_adjustment_quote_token_amount = quote_token_account.amount as i64;
//     quote_token_account.reload()?;
//     let post_adjustment_quote_token_amount = quote_token_account.amount as i64;

//     Ok(pre_adjustment_quote_token_amount - post_adjustment_quote_token_amount)
// }

// /// Adjust hedge if current tick is above last_hedge_adjustment_tick
// ///
// /// vault_position changes
// ///     - borrowed_base_amount
// ///     - notional_borrowed_amount
// ///     - notional_borrowed_amount_diff
// pub fn above_handler(ctx: Context<AdjustVaultHedge>) -> Result<()> {
//     validate_hedge(&ctx.accounts.vault_position)?;

//     let vault_position = &ctx.accounts.vault_position;
//     let whirlpool = &ctx.accounts.whirlpool;

//     let hedge_tick_range = ctx.accounts.vault.hedge_tick_range as i32;
//     let last_adjustment_tick = vault_position.last_hedge_adjustment_tick_index.unwrap();

//     let upper_hedge_tick = last_adjustment_tick + hedge_tick_range / 2;
//     let current_tick = whirlpool.tick_current_index;

//     if current_tick < upper_hedge_tick {
//         msg!("Can not adjust vault_position hedge, current tick is not above upper hedge boundary");
//         return Err(SurfError::CustomError.into());
//     }

//     let current_sqrt_price = whirlpool.sqrt_price;
//     let upper_sqrt_price = vault_position.upper_sqrt_price;
//     let hedged_liquidity = vault_position.hedged_liquidity;

//     let current_pool_base_token_amount =
//         get_amount_delta_a_wrapped(current_sqrt_price, upper_sqrt_price, hedged_liquidity, true)?;
//     let current_borrowed_base_token_amount = vault_position.borrowed_base_amount;

//     let base_token_diff = current_borrowed_base_token_amount - current_pool_base_token_amount;

//     // BUY BASE TOKEN
//     whirlpool_cpi::swap(
//         ctx.accounts.swap_context(),
//         base_token_diff,
//         u64::MAX,
//         MAX_SQRT_PRICE_X64,
//         false,
//         false,
//     )?;

//     let notional_diff = get_notional_diff(&mut ctx.accounts.vault_quote_token_account)?;

//     // REPAY BASE TOKEN
//     drift_cpi::deposit(
//         ctx.accounts.repay_borrowed_context(),
//         1,
//         base_token_diff,
//         true,
//     )?;

//     // UPDATE VAULT POSITION
//     ctx.accounts
//         .vault_position
//         .adjust_hedge(base_token_diff as i64, notional_diff);

//     Ok(())
// }

// #[derive(Accounts)]
// pub struct AdjustVaultHedgeAbove<'info> {
//     pub payer: Signer<'info>,

//     pub whirlpool: Box<Account<'info, Whirlpool>>,

//     #[account(
//         has_one = whirlpool,
//     )]
//     pub vault: Box<Account<'info, Vault>>,

//     #[account(
//         mut,
//         address = vault.base_token_account,
//     )]
//     pub vault_base_token_account: Account<'info, TokenAccount>,
//     #[account(
//         mut,
//         address = vault.quote_token_account,
//     )]
//     pub vault_quote_token_account: Account<'info, TokenAccount>,

//     #[account(
//         mut,
//         seeds = [
//             VaultPosition::NAMESPACE.as_ref(),
//             vault.key().as_ref(),
//             vault.vault_positions_count.to_le_bytes().as_ref()
//         ],
//         bump = vault_position.bump,
//     )]
//     pub vault_position: Box<Account<'info, VaultPosition>>,

//     // ------------
//     // SWAP ACCOUNTS
//     pub swap_whirlpool: Box<Account<'info, Whirlpool>>,

//     #[account(
//         mut,
//         address = swap_whirlpool.token_vault_a,
//     )]
//     pub swap_whirlpool_base_account: Box<Account<'info, TokenAccount>>,
//     #[account(
//         mut,
//         address = swap_whirlpool.token_vault_b,
//     )]
//     pub swap_whirlpool_quote_account: Box<Account<'info, TokenAccount>>,

//     #[account(mut)]
//     pub tick_array_0: AccountLoader<'info, TickArray>,
//     #[account(mut)]
//     pub tick_array_1: AccountLoader<'info, TickArray>,
//     #[account(mut)]
//     pub tick_array_2: AccountLoader<'info, TickArray>,

//     /// CHECK: Whirlpool CPI
//     pub swap_oracle: UncheckedAccount<'info>,

//     // ------------
//     // DRIFT ACCOUNTS
//     pub drift_state: Box<Account<'info, DriftState>>,
//     // CHECK: Drift program checks
//     pub drift_signer: UncheckedAccount<'info>,

//     #[account(
//         mut,
//         address = vault.drift_stats,
//     )]
//     pub drift_stats: AccountLoader<'info, DriftStats>,
//     #[account(
//         mut,
//         address = vault.drift_subaccount,
//     )]
//     pub drift_subaccount: AccountLoader<'info, DriftSubaccount>,

//     #[account(
//         mut,
//         seeds = [
//             b"spot_market_vault".as_ref(),
//             1_u16.to_le_bytes().as_ref(),
//         ],
//         bump,
//         seeds::program = drift_program.key(),
//     )]
//     pub drift_base_spot_market_vault: Box<Account<'info, TokenAccount>>,

//     pub whirlpool_program: Program<'info, WhirlpoolProgram>,
//     pub drift_program: Program<'info, Drift>,
//     pub token_program: Program<'info, Token>,
// }

// impl<'info> AdjustVaultHedgeAbove<'info> {
//     pub fn swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
//         let program = &self.whirlpool_program;
//         let accounts = Swap {
//             whirlpool: self.swap_whirlpool.to_account_info(),
//             token_vault_a: self.swap_whirlpool_base_account.to_account_info(),
//             token_vault_b: self.swap_whirlpool_quote_account.to_account_info(),
//             oracle: self.swap_oracle.to_account_info(),
//             tick_array0: self.tick_array_0.to_account_info(),
//             tick_array1: self.tick_array_1.to_account_info(),
//             tick_array2: self.tick_array_2.to_account_info(),
//             token_authority: self.vault.to_account_info(),
//             token_owner_account_a: self.vault_base_token_account.to_account_info(),
//             token_owner_account_b: self.vault_quote_token_account.to_account_info(),
//             token_program: self.token_program.to_account_info(),
//         };
//         CpiContext::new(program.to_account_info(), accounts)
//     }

//     pub fn repay_context(&self) -> CpiContext<'_, '_, '_, 'info, DriftDeposit<'info>> {
//         let program = &self.drift_program;
//         let accounts = DriftDeposit {
//             state: self.drift_state.to_account_info(),
//             user: self.drift_subaccount.to_account_info(),
//             user_stats: self.drift_stats.to_account_info(),
//             authority: self.vault.to_account_info(),
//             user_token_account: self.vault_base_token_account.to_account_info(),
//             spot_market_vault: self.drift_base_spot_market_vault.to_account_info(),
//             token_program: self.token_program.to_account_info(),
//         };
//         // TODO: remaining accounts
//         CpiContext::new(program.to_account_info(), accounts)
//     }
// }

// pub fn handler(ctx: Context<AdjustVaultHedge>) -> Result<()> {
//     let whirlpool = &ctx.accounts.whirlpool;
//     let vault_position = &ctx.accounts.vault_position;
//     let vault = &ctx.accounts.vault;

//     // If last_hedge_adjustment_tick_index not, no liquidity is hedged, nothing to adjust
//     if None == vault_position.last_hedge_adjustment_tick_index {
//         // TODO: Handle differently... hedge_liquidity probably initializes on first hedge ???
//         return Err(SurfError::VaultPositionNotHedged.into());
//     }

//     let hedge_tick_range = vault.hedge_tick_range as i32;
//     let last_adjustment_tick = vault_position.last_hedge_adjustment_tick_index.unwrap();

//     let upper_hedge_tick_range_boundary = last_adjustment_tick + hedge_tick_range / 2;
//     let lower_hedge_tick_range_boundary = last_adjustment_tick - hedge_tick_range / 2;

//     let current_tick = whirlpool.tick_current_index;

//     if current_tick < upper_hedge_tick_range_boundary
//         && current_tick > lower_hedge_tick_range_boundary
//     {
//         msg!("Can not adjust hedge of vault_position inside of hedge_tick_range");
//         return Err(SurfError::CustomError.into());
//     }

//     let current_sqrt_price = whirlpool.sqrt_price;
//     let upper_sqrt_price = vault_position.upper_sqrt_price;

//     // if current tick is higher than LHAT (last hedge adjustment tick)
//     //  - sell borrowed base token
//     //  - repay bought amount
//     if current_tick > upper_hedge_tick_range_boundary {
//         // CALCULATE DIFF BETWEEN CURRENT BORROWED AND CURRENT POOL AMOUNTS
//         let current_pool_base_token_amount = get_amount_delta_a_wrapped(
//             current_sqrt_price,
//             upper_sqrt_price,
//             vault_position.hedged_liquidity,
//             true,
//         )?;
//         let current_borrowed_base_token_amount = vault_position.borrowed_base_amount;
//         let borrowed_diff = current_borrowed_base_token_amount - current_pool_base_token_amount;

//         // BUY DIFF

//         // DEPOSIT SOL TO DRIFT
//     }

//     // if current tick is lower than LHAT
//     //  - borrow more base token
//     //  - sell borrowed amount for quote

//     Ok(())
// }

// #[derive(Accounts)]
// pub struct AdjustVaultHedge<'info> {
//     pub payer: Signer<'info>,

//     #[account(
//         mut,
//         seeds = [
//             VaultPosition::NAMESPACE.as_ref(),
//             vault.key().as_ref(),
//             vault.vault_positions_count.to_le_bytes().as_ref(),
//         ],
//         bump = vault_position.bump,
//     )]
//     pub vault_position: Account<'info, VaultPosition>,

//     #[account(
//         has_one = whirlpool,
//     )]
//     pub vault: Account<'info, Vault>,

//     #[account(
//         mut,
//         address = vault.base_token_account,
//     )]
//     pub vault_base_token_account: Box<Account<'info, TokenAccount>>,
//     #[account(
//         mut,
//         address = vault.quote_token_account,
//     )]
//     pub vault_quote_token_account: Box<Account<'info, TokenAccount>>,

//     pub whirlpool: Box<Account<'info, Whirlpool>>,

//     // ---------
//     // DRIFT ACCOUNTS
//     pub drift_state: Box<Account<'info, DriftState>>,
//     // CHECK: Drift program checks
//     pub drift_signer: UncheckedAccount<'info>,

//     /// CHECK: Drift program checks these accounts
//     pub drift_base_token_oracle: UncheckedAccount<'info>,
//     #[account(
//         mut,
//         seeds = [
//             b"spot_market_vault".as_ref(),
//             1_u16.to_le_bytes().as_ref(),
//         ],
//         bump,
//         seeds::program = drift_program.key(),
//     )]
//     pub drift_base_spot_market_vault: Box<Account<'info, TokenAccount>>,
//     pub drift_base_spot_market: AccountLoader<'info, DriftSpotMarket>,

//     #[account(
//         mut,
//         seeds = [
//             b"spot_market_vault".as_ref(),
//             0_u16.to_le_bytes().as_ref(),
//         ],
//         bump,
//         seeds::program = drift_program.key(),
//     )]
//     pub drift_quote_spot_market_vault: Box<Account<'info, TokenAccount>>,
//     #[account(mut)]
//     pub drift_quote_spot_market: AccountLoader<'info, DriftSpotMarket>,

//     #[account(
//         mut,
//         address = vault.drift_stats,
//     )]
//     pub drift_stats: AccountLoader<'info, DriftStats>,
//     #[account(
//         mut,
//         address = vault.drift_subaccount,
//     )]
//     pub drift_subaccount: AccountLoader<'info, DriftSubaccount>,

//     // -----------
//     // SWAP WHIRLPOOL
//     pub swap_whirlpool: Box<Account<'info, Whirlpool>>,

//     #[account(
//         mut,
//         address = swap_whirlpool.token_vault_a,
//     )]
//     pub swap_whirlpool_base_token_vault: Box<Account<'info, TokenAccount>>,
//     #[account(
//         mut,
//         address = swap_whirlpool.token_vault_b,
//     )]
//     pub swap_whirlpool_quote_token_vault: Box<Account<'info, TokenAccount>>,

//     #[account(mut)]
//     pub swap_tick_array0: AccountLoader<'info, TickArray>,
//     #[account(mut)]
//     pub swap_tick_array1: AccountLoader<'info, TickArray>,
//     #[account(mut)]
//     pub swap_tick_array2: AccountLoader<'info, TickArray>,

//     /// CHECK: Whirlpool CPI
//     pub swap_oracle: UncheckedAccount<'info>,

//     pub drift_program: Program<'info, Drift>,
//     pub whirlpool_program: Program<'info, WhirlpoolProgram>,
//     pub token_program: Program<'info, Token>,
// }

// impl<'info> AdjustVaultHedge<'info> {
//     pub fn repay_borrowed_context(&self) -> CpiContext<'_, '_, '_, 'info, DriftDeposit<'info>> {
//         let program = &self.drift_program;
//         let accounts = DriftDeposit {
//             state: self.drift_state.to_account_info(),
//             spot_market_vault: self.drift_base_spot_market_vault.to_account_info(),
//             authority: self.vault.to_account_info(),
//             user_token_account: self.vault_base_token_account.to_account_info(),
//             user: self.drift_subaccount.to_account_info(),
//             user_stats: self.drift_stats.to_account_info(),
//             token_program: self.token_program.to_account_info(),
//         };
//         CpiContext::new(program.to_account_info(), accounts)
//             .with_remaining_accounts(vec![self.drift_quote_spot_market.to_account_info()])
//     }

//     pub fn swap_context(&self) -> CpiContext<'_, '_, '_, 'info, Swap<'info>> {
//         let program = &self.whirlpool_program;
//         let accounts = Swap {
//             whirlpool: self.swap_whirlpool.to_account_info(),
//             token_vault_a: self.swap_whirlpool_base_token_vault.to_account_info(),
//             token_vault_b: self.swap_whirlpool_quote_token_vault.to_account_info(),
//             token_authority: self.vault.to_account_info(),
//             token_owner_account_a: self.vault_base_token_account.to_account_info(),
//             token_owner_account_b: self.vault_quote_token_account.to_account_info(),
//             tick_array0: self.swap_tick_array0.to_account_info(),
//             tick_array1: self.swap_tick_array1.to_account_info(),
//             tick_array2: self.swap_tick_array2.to_account_info(),
//             oracle: self.swap_oracle.to_account_info(),
//             token_program: self.token_program.to_account_info(),
//         };
//         CpiContext::new(program.to_account_info(), accounts)
//     }
// }
