#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    Unauthorized = 2,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    SupportCount,
    RecipientCount(Address),
    RecipientTotal(Address),
    TotalByAsset(Address, Address), // (Recipient, Asset)
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
    pub fn support(
        e: Env,
        s: Address,
        r: Address,
        asset: Address,
        o: i128,
        c: String,
        m: String,
    ) -> Result<u32, Error> {
        s.require_auth();
        if o <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Transfer funds from supporter to contract
        let client = soroban_sdk::token::Client::new(&e, &asset);
        client.transfer(&s, &e.current_contract_address(), &o);

        let st = e.storage().persistent();
        let ct: u32 = st.get(&DataKey::SupportCount).unwrap_or(0);
        let nct = ct + 1;
        st.set(&DataKey::SupportCount, &nct);

        let rct: u32 = st.get(&DataKey::RecipientCount(r.clone())).unwrap_or(0);
        let nrct = rct + 1;
        st.set(&DataKey::RecipientCount(r.clone()), &nrct);

        let total: i128 = st.get(&DataKey::RecipientTotal(r.clone())).unwrap_or(0);
        st.set(&DataKey::RecipientTotal(r.clone()), &(total + o));

        let asset_total: i128 = st
            .get(&DataKey::TotalByAsset(r.clone(), asset.clone()))
            .unwrap_or(0);
        st.set(&DataKey::TotalByAsset(r.clone(), asset.clone()), &(asset_total + o));

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

    pub fn withdraw(
        e: Env,
        caller: Address,
        recipient: Address,
        asset: Address,
        amount: i128,
    ) -> Result<(), Error> {
        caller.require_auth();
        if caller != recipient {
            return Err(Error::Unauthorized);
        }

        let st = e.storage().persistent();
        let key = DataKey::TotalByAsset(recipient.clone(), asset.clone());
        let balance: i128 = st.get(&key).unwrap_or(0);

        if amount > balance || amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Transfer funds from contract to recipient
        let client = soroban_sdk::token::Client::new(&e, &asset);
        client.transfer(&e.current_contract_address(), &recipient, &amount);

        // Deduct from TotalByAsset storage
        st.set(&key, &(balance - amount));

        // Emit a withdraw event
        e.events().publish(
            (symbol_short!("withdraw"), caller, asset),
            amount,
        );

        Ok(())
    }

    pub fn support_count(e: Env) -> u32 {
        e.storage().persistent().get(&DataKey::SupportCount).unwrap_or(0)
    }

    pub fn recipient_count(e: Env, r: Address) -> u32 {
        e.storage().persistent().get(&DataKey::RecipientCount(r)).unwrap_or(0)
    }

    pub fn get_total_by_asset(e: Env, r: Address, asset: Address) -> i128 {
        e.storage()
            .persistent()
            .get(&DataKey::TotalByAsset(r, asset))
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
        let admin = Address::generate(&e);
        let asset = e.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_admin = soroban_sdk::token::StellarAssetClient::new(&e, &asset);
        token_admin.mint(&supporter, &10_000_000_i128);

        let _ = client.support(
            &supporter,
            &recipient,
            &asset,
            &5_000_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "First support"),
        );
        let _ = client.support(
            &supporter,
            &recipient,
            &asset,
            &3_000_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "Second support"),
        );

        assert_eq!(client.get_total_by_asset(&recipient, &asset), 8_000_000_i128);
    }

    #[test]
    fn keeps_totals_independent_per_recipient_and_asset() {
        let e = Env::default();
        e.mock_all_auths();
        let contract_id = e.register(SupportPageContract, ());
        let client = SupportPageContractClient::new(&e, &contract_id);

        let supporter = Address::generate(&e);
        let recipient_one = Address::generate(&e);
        let recipient_two = Address::generate(&e);
        let admin = Address::generate(&e);
        let asset_one = e.register_stellar_asset_contract_v2(admin.clone()).address();
        let asset_two = e.register_stellar_asset_contract_v2(admin.clone()).address();
        
        let token_admin_one = soroban_sdk::token::StellarAssetClient::new(&e, &asset_one);
        let token_admin_two = soroban_sdk::token::StellarAssetClient::new(&e, &asset_two);
        token_admin_one.mint(&supporter, &10_000_000_i128);
        token_admin_two.mint(&supporter, &10_000_000_i128);

        let _ = client.support(
            &supporter,
            &recipient_one,
            &asset_one,
            &4_000_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "Support one"),
        );
        let _ = client.support(
            &supporter,
            &recipient_two,
            &asset_two,
            &7_000_000_i128,
            &String::from_str(&e, "USDC"),
            &String::from_str(&e, "Support two"),
        );

        assert_eq!(client.get_total_by_asset(&recipient_one, &asset_one), 4_000_000_i128);
        assert_eq!(client.get_total_by_asset(&recipient_two, &asset_two), 7_000_000_i128);
    }

    #[test]
    fn successful_withdraw() {
        let e = Env::default();
        e.mock_all_auths();
        let contract_id = e.register(SupportPageContract, ());
        let client = SupportPageContractClient::new(&e, &contract_id);

        let supporter = Address::generate(&e);
        let recipient = Address::generate(&e);
        let admin = Address::generate(&e);
        let asset = e.register_stellar_asset_contract_v2(admin.clone()).address();
        
        let token_admin = soroban_sdk::token::StellarAssetClient::new(&e, &asset);
        token_admin.mint(&supporter, &10_000_i128);

        // Initial support
        client.support(
            &supporter,
            &recipient,
            &asset,
            &10_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "Support"),
        );

        assert_eq!(client.get_total_by_asset(&recipient, &asset), 10_000_i128);

        // Withdraw half
        client.withdraw(&recipient, &recipient, &asset, &5_000_i128);

        assert_eq!(client.get_total_by_asset(&recipient, &asset), 5_000_i128);
        
        // Verify token balance of recipient
        let token_client = soroban_sdk::token::Client::new(&e, &asset);
        assert_eq!(token_client.balance(&recipient), 5_000_i128);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")] // Error::Unauthorized
    fn unauthorized_withdraw() {
        let e = Env::default();
        e.mock_all_auths();
        let contract_id = e.register(SupportPageContract, ());
        let client = SupportPageContractClient::new(&e, &contract_id);

        let supporter = Address::generate(&e);
        let recipient = Address::generate(&e);
        let attacker = Address::generate(&e);
        let admin = Address::generate(&e);
        let asset = e.register_stellar_asset_contract_v2(admin.clone()).address();
        
        let token_admin = soroban_sdk::token::StellarAssetClient::new(&e, &asset);
        token_admin.mint(&supporter, &10_000_i128);

        client.support(
            &supporter,
            &recipient,
            &asset,
            &10_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "Support"),
        );

        // Attacker tries to withdraw recipient's funds
        client.withdraw(&attacker, &recipient, &asset, &5_000_i128);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")] // Error::InvalidAmount
    fn over_withdraw() {
        let e = Env::default();
        e.mock_all_auths();
        let contract_id = e.register(SupportPageContract, ());
        let client = SupportPageContractClient::new(&e, &contract_id);

        let supporter = Address::generate(&e);
        let recipient = Address::generate(&e);
        let admin = Address::generate(&e);
        let asset = e.register_stellar_asset_contract_v2(admin.clone()).address();
        
        let token_admin = soroban_sdk::token::StellarAssetClient::new(&e, &asset);
        token_admin.mint(&supporter, &10_000_i128);

        client.support(
            &supporter,
            &recipient,
            &asset,
            &10_000_i128,
            &String::from_str(&e, "XLM"),
            &String::from_str(&e, "Support"),
        );

        // Try to withdraw more than balance
        client.withdraw(&recipient, &recipient, &asset, &15_000_i128);
    }
}
