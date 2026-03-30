#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error { InvalidAmount = 1 }

#[derive(Clone)]
#[contracttype]
pub enum DataKey { SupportCount, RecipientCount(Address) }

#[derive(Clone)]
#[contracttype]
pub struct SupportEvent {
    pub supporter: Address,
    pub recipient: Address,
    pub amount: i128,
    pub asset_code: String,
    pub message: String,
    pub timestamp: u64,
}

#[contract]
pub struct SupportPageContract;

#[contractimpl]
impl SupportPageContract {
    pub fn support(e: Env, s: Address, r: Address, o: i128, c: String, m: String) -> Result<u32, Error> {
        s.require_auth();
        if o <= 0 { return Err(Error::InvalidAmount); }
        let mut st = e.storage().persistent();
        let ct: u32 = st.get(&DataKey::SupportCount).unwrap_or(0);
        let nct = ct + 1;
        st.set(&DataKey::SupportCount, &nct);
        let rct: u32 = st.get(&DataKey::RecipientCount(r.clone())).unwrap_or(0);
        let nrct = rct + 1;
        st.set(&DataKey::RecipientCount(r.clone()), &nrct);
        let tt = symbol_short!("support");
        let ev = SupportEvent {
            supporter:s, recipient:r, amount:o, asset_code:c, message:m, timestamp: e.ledger().timestamp()
        };
        e.events().publish((tt,), ev);
        Ok(nct)
    }
    pub fn support_count(e: Env) -> u32 {
        e.storage().persistent().get(&DataKey::SupportCount).unwrap_or(0)
    }
    pub fn recipient_count(e: Env, r: Address) -> u32 {
        e.storage().persistent().get(&DataKey::RecipientCount(r)).unwrap_or(0)
    }
}
