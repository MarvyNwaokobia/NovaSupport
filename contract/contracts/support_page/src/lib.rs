#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    SupportCount,
    RecipientCount(Address),
    RecipientTotal(Address),
}

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
        if o <= 0 {
            return Err(Error::InvalidAmount);
        }

        let st = e.storage().persistent();
        let ct: u32 = st.get(&DataKey::SupportCount).unwrap_or(0);
        let nct = ct + 1;
        st.set(&DataKey::SupportCount, &nct);

        let rct: u32 = st.get(&DataKey::RecipientCount(r.clone())).unwrap_or(0);
        let nrct = rct + 1;
        st.set(&DataKey::RecipientCount(r.clone()), &nrct);

        let total: i128 = st.get(&DataKey::RecipientTotal(r.clone())).unwrap_or(0);
        st.set(&DataKey::RecipientTotal(r.clone()), &(total + o));

        let tt = symbol_short!("support");
        let ev = SupportEvent {
            supporter: s,
            recipient: r,
            amount: o,
            asset_code: c,
            message: m,
            timestamp: e.ledger().timestamp(),
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

    pub fn get_total_amount(e: Env, r: Address) -> i128 {
        e.storage()
            .persistent()
            .get(&DataKey::RecipientTotal(r))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    #[test]
    fn tracks_total_amount_per_recipient() {
        let e = Env::default();
        e.mock_all_auths();
        let contract_id = e.register(SupportPageContract, ());
        let client = SupportPageContractClient::new(&e, &contract_id);

        let supporter = Address::generate(&e);
        let recipient = Address::generate(&e);

        let _ = client.support(
            &supporter,
            &recipient,
            &5_000_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "First support"),
        );
        let _ = client.support(
            &supporter,
            &recipient,
            &3_000_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "Second support"),
        );

        assert_eq!(client.get_total_amount(&recipient), 8_000_000_i128);
    }

    #[test]
    fn keeps_totals_independent_per_recipient() {
        let e = Env::default();
        e.mock_all_auths();
        let contract_id = e.register(SupportPageContract, ());
        let client = SupportPageContractClient::new(&e, &contract_id);

        let supporter = Address::generate(&e);
        let recipient_one = Address::generate(&e);
        let recipient_two = Address::generate(&e);

        let _ = client.support(
            &supporter,
            &recipient_one,
            &4_000_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "Support one"),
        );
        let _ = client.support(
            &supporter,
            &recipient_two,
            &7_000_000_i128,
            &String::from_str(&e, "USDC"),
            &String::from_str(&e, "Support two"),
        );

        assert_eq!(client.get_total_amount(&recipient_one), 4_000_000_i128);
        assert_eq!(client.get_total_amount(&recipient_two), 7_000_000_i128);
    }
}
