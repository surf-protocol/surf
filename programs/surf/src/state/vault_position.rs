use anchor_lang::prelude::*;

#[account]
pub struct VaultPosition {
    bump: u8,

    id: u64,
    whirlpool_position: Option<Pubkey>,
    is_closed: bool,

    close_sqrt_price: Option<i32>,
    upper_sqrt_price: i32,
    lower_sqrt_price: i32,

    // Fee growth at time of close of the whirlpool position
    base_token_fee_growth: u128,
    quote_token_fee_growth: u128,

    base_token_fee_growth_unclaimed: u128,
    quote_token_fee_growth_unclaimed: u128,
}

impl VaultPosition {
    pub const LEN: usize = 8 + 104;
    pub const NAMESPACE: &'static [u8; 14] = b"vault_position";

    pub fn open(
        &mut self,
        bump: u8,
        id: u64,
        whirlpool_position: Pubkey,
        upper_sqrt_price: i32,
        lower_sqrt_price: i32,
    ) -> () {
        self.bump = bump;
        self.id = id;
        self.whirlpool_position = Some(whirlpool_position);
        self.is_closed = false;

        self.upper_sqrt_price = upper_sqrt_price;
        self.lower_sqrt_price = lower_sqrt_price;
        self.close_sqrt_price = None;

        self.base_token_fee_growth_unclaimed = 0;
        self.quote_token_fee_growth_unclaimed = 0;
    }

    pub fn close(
        &mut self,
        close_sqrt_price: i32,
        base_token_fee_growth: u128,
        quote_token_fee_growth: u128,
    ) -> () {
        self.close_sqrt_price = Some(close_sqrt_price);
        self.whirlpool_position = None;
        self.is_closed = true;

        self.base_token_fee_growth = base_token_fee_growth;
        self.quote_token_fee_growth = quote_token_fee_growth;
    }
}
