use anchor_lang::prelude::*;
use drift::cpi::accounts::{Deposit, UpdateSpotMarketCumulativeInterest, Withdraw};

pub trait DriftDepositCollateralContext<'info> {
    fn drift_deposit_collateral_context(&self) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>>;
}

pub trait DriftWithdrawCollateralContext<'info> {
    fn drift_withdraw_collateral_context(&self) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>>;
}

pub trait DriftWithdrawBorrowContext<'info> {
    fn drift_withdraw_borrow_context(&self) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>>;
}

pub trait DriftDepositBorrowContext<'info> {
    fn drift_deposit_borrow_context(&self) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>>;
}

pub trait UpdateBorrowSpotMarketContext<'info> {
    fn update_borrow_spot_market_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, UpdateSpotMarketCumulativeInterest<'info>>;
}

pub trait UpdateCollateralSpotMarketContext<'info> {
    fn update_collateral_spot_market_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, UpdateSpotMarketCumulativeInterest<'info>>;
}

#[macro_export]
macro_rules! drift_deposit_collateral_context_impl {
    ($struct_name:ident) => {
        use drift::cpi::accounts::Deposit;

        use crate::macros::DriftDepositCollateralContext;

        impl<'info> DriftDepositCollateralContext<'info> for $struct_name<'info> {
            fn drift_deposit_collateral_context(
                &self,
            ) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>> {
                let program = &self.drift_program;
                let accounts = Deposit {
                    authority: self.vault_state.to_account_info(),
                    user_token_account: self.vault_quote_token_account.to_account_info(),
                    user: self.drift_subaccount.to_account_info(),
                    user_stats: self.drift_stats.to_account_info(),
                    state: self.drift_state.to_account_info(),
                    spot_market_vault: self.drift_collateral_vault.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                };
                CpiContext::new(program.to_account_info(), accounts).with_remaining_accounts(vec![
                    self.drift_collateral_spot_market.to_account_info(),
                ])
            }
        }
    };
}

#[macro_export]
macro_rules! drift_withdraw_collateral_context_impl {
    ($struct_name:ident) => {
        use drift::cpi::accounts::Withdraw;

        use crate::macros::DriftWithdrawCollateralContext;

        impl<'info> DriftWithdrawCollateralContext<'info> for $struct_name<'info> {
            fn drift_withdraw_collateral_context(
                &self,
            ) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>> {
                let program = &self.drift_program;
                let accounts = Withdraw {
                    state: self.drift_state.to_account_info(),
                    drift_signer: self.drift_signer.to_account_info(),
                    spot_market_vault: self.drift_collateral_vault.to_account_info(),
                    authority: self.vault_state.to_account_info(),
                    user_token_account: self.vault_quote_token_account.to_account_info(),
                    user: self.drift_subaccount.to_account_info(),
                    user_stats: self.drift_stats.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                };
                CpiContext::new(program.to_account_info(), accounts).with_remaining_accounts(vec![
                    self.drift_collateral_spot_market.to_account_info(),
                    self.drift_borrow_spot_market.to_account_info(),
                ])
            }
        }
    };
}

#[macro_export]
macro_rules! drift_withdraw_borrow_context_impl {
    ($struct_name:ident) => {
        use drift::cpi::accounts::Withdraw;

        use crate::macros::DriftWithdrawBorrowContext;

        impl<'info> DriftWithdrawBorrowContext<'info> for $struct_name<'info> {
            fn drift_withdraw_borrow_context(
                &self,
            ) -> CpiContext<'_, '_, '_, 'info, Withdraw<'info>> {
                let program = &self.drift_program;
                let accounts = Withdraw {
                    state: self.drift_state.to_account_info(),
                    drift_signer: self.drift_signer.to_account_info(),
                    spot_market_vault: self.drift_borrow_vault.to_account_info(),
                    authority: self.vault_state.to_account_info(),
                    user_token_account: self.vault_base_token_account.to_account_info(),
                    user: self.drift_subaccount.to_account_info(),
                    user_stats: self.drift_stats.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                };
                CpiContext::new(program.to_account_info(), accounts).with_remaining_accounts(vec![
                    self.drift_base_token_oracle.to_account_info(),
                    self.drift_collateral_spot_market.to_account_info(),
                    self.drift_borrow_spot_market.to_account_info(),
                ])
            }
        }
    };
}

#[macro_export]
macro_rules! drift_deposit_borrow_context_impl {
    ($struct_name:ident) => {
        use drift::cpi::accounts::Deposit;

        use crate::macros::DriftDepositBorrowContext;

        impl<'info> DriftDepositBorrowContext<'info> for $struct_name<'info> {
            fn drift_deposit_borrow_context(
                &self,
            ) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>> {
                let program = &self.drift_program;
                let accounts = Deposit {
                    authority: self.vault_state.to_account_info(),
                    user_token_account: self.vault_base_token_account.to_account_info(),
                    user: self.drift_subaccount.to_account_info(),
                    user_stats: self.drift_stats.to_account_info(),
                    state: self.drift_state.to_account_info(),
                    spot_market_vault: self.drift_borrow_vault.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                };
                CpiContext::new(program.to_account_info(), accounts).with_remaining_accounts(vec![
                    self.drift_base_token_oracle.to_account_info(),
                    self.drift_borrow_spot_market.to_account_info(),
                ])
            }
        }
    };
}

#[macro_export]
macro_rules! update_borrow_spot_market_context_impl {
    ($struct_name:ident) => {
        use drift::cpi::accounts::UpdateSpotMarketCumulativeInterest;

        use crate::macros::UpdateBorrowSpotMarketContext;

        impl<'info> UpdateBorrowSpotMarketContext<'info> for $struct_name<'info> {
            fn update_borrow_spot_market_context(
                &self,
            ) -> CpiContext<'_, '_, '_, 'info, UpdateSpotMarketCumulativeInterest<'info>> {
                let program = &self.drift_program;
                let accounts = UpdateSpotMarketCumulativeInterest {
                    state: self.drift_state.to_account_info(),
                    spot_market: self.drift_borrow_spot_market.to_account_info(),
                    oracle: self.drift_base_token_oracle.to_account_info(),
                };
                CpiContext::new(program.to_account_info(), accounts)
            }
        }
    };
}

#[macro_export]
macro_rules! update_collateral_spot_market_context_impl {
    ($struct_name:ident) => {
        use crate::macros::UpdateCollateralSpotMarketContext;

        impl<'info> UpdateCollateralSpotMarketContext<'info> for $struct_name<'info> {
            fn update_collateral_spot_market_context(
                &self,
            ) -> CpiContext<'_, '_, '_, 'info, UpdateSpotMarketCumulativeInterest<'info>> {
                let program = &self.drift_program;
                let accounts = UpdateSpotMarketCumulativeInterest {
                    state: self.drift_state.to_account_info(),
                    spot_market: self.drift_collateral_spot_market.to_account_info(),
                    oracle: self.drift_quote_token_oracle.to_account_info(),
                };
                CpiContext::new(program.to_account_info(), accounts)
            }
        }
    };
}
