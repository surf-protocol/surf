use anchor_lang::prelude::*;
use drift::cpi::accounts::Deposit;

pub trait DriftDepositContext<'info> {
    fn drift_deposit_collateral_context(&self) -> CpiContext<'_, '_, '_, 'info, Deposit<'info>>;
}

#[macro_export]
macro_rules! drift_deposit_collateral_context_impl {
    ($struct_name:ident) => {
        use crate::macros::DriftDepositContext;

        impl<'info> DriftDepositContext<'info> for $struct_name<'info> {
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
                CpiContext::new(program.to_account_info(), accounts)
                    .with_remaining_accounts(vec![self.collateral_spot_market.to_account_info()])
            }
        }
    };
}
