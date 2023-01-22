use anchor_lang::prelude::*;

use crate::state::AdminConfig;

pub fn is_admin<'info>(admin_config: &Account<'info, AdminConfig>, admin: &Signer<'info>) -> bool {
    admin_config.admin_key.eq(&admin.key())
}
