#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Vec};

const TTL_THRESHOLD: u32 = 100;
const TTL_EXTEND_TO: u32 = 518400;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Issuer(Address),
    Achievements(Address),
    NextId,
}

#[contracttype]
#[derive(Clone)]
pub struct Achievement {
    pub id: u32,
    pub student: Address,
    pub issuer: Address,
    pub title: String,
    pub category: String,
    pub issuer_name: String,
    pub cid: String,
    pub issued_ledger: u32,
}

#[contract]
pub struct ScholarPassContract;

#[contractimpl]
impl ScholarPassContract {
    pub fn initialize(env: Env, admin: Address) {
        let admin_key = DataKey::Admin;
        if env.storage().persistent().has(&admin_key) {
            panic!("already initialized");
        }

        let issuer_key = DataKey::Issuer(admin.clone());
        let next_id_key = DataKey::NextId;
        env.storage().persistent().set(&admin_key, &admin);
        env.storage().persistent().set(&issuer_key, &true);
        env.storage().persistent().set(&next_id_key, &1u32);
        Self::extend_key_ttl(&env, &admin_key);
        Self::extend_key_ttl(&env, &issuer_key);
        Self::extend_key_ttl(&env, &next_id_key);
    }

    pub fn add_issuer(env: Env, issuer: Address) {
        let admin = Self::read_admin(&env);
        admin.require_auth();

        let key = DataKey::Issuer(issuer);
        env.storage().persistent().set(&key, &true);
        Self::extend_key_ttl(&env, &key);
    }

    pub fn remove_issuer(env: Env, issuer: Address) {
        let admin = Self::read_admin(&env);
        admin.require_auth();

        let key = DataKey::Issuer(issuer);
        env.storage().persistent().set(&key, &false);
        Self::extend_key_ttl(&env, &key);
    }

    pub fn is_issuer(env: Env, issuer: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Issuer(issuer))
            .unwrap_or(false)
    }

    pub fn issue(
        env: Env,
        issuer: Address,
        student: Address,
        title: String,
        category: String,
        issuer_name: String,
        cid: String,
    ) -> u32 {
        issuer.require_auth();

        if !Self::is_issuer(env.clone(), issuer.clone()) {
            panic!("issuer not authorized");
        }

        let next_id_key = DataKey::NextId;
        let id: u32 = env.storage().persistent().get(&next_id_key).unwrap_or(1);
        let achievement = Achievement {
            id,
            student: student.clone(),
            issuer: issuer.clone(),
            title,
            category,
            issuer_name,
            cid,
            issued_ledger: env.ledger().sequence(),
        };

        let mut achievements = Self::get_achievements(env.clone(), student.clone());
        achievements.push_back(achievement);

        env.storage()
            .persistent()
            .set(&DataKey::Achievements(student.clone()), &achievements);
        env.storage().persistent().set(&next_id_key, &(id + 1));
        Self::extend_key_ttl(&env, &DataKey::Achievements(student.clone()));
        Self::extend_key_ttl(&env, &next_id_key);

        env.events()
            .publish((symbol_short!("issued"), student), id);

        id
    }

    pub fn get_achievements(env: Env, student: Address) -> Vec<Achievement> {
        env.storage()
            .persistent()
            .get(&DataKey::Achievements(student))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_achievement_count(env: Env, student: Address) -> u32 {
        Self::get_achievements(env, student).len()
    }

    fn read_admin(env: &Env) -> Address {
        env.storage().persistent().get(&DataKey::Admin).unwrap()
    }

    fn extend_key_ttl(env: &Env, key: &DataKey) {
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn admin_can_issue_achievement() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ScholarPassContract, ());
        let client = ScholarPassContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let student = Address::generate(&env);

        client.initialize(&admin);
        assert!(client.is_issuer(&admin));

        let id = client.issue(
            &admin,
            &student,
            &String::from_str(&env, "AI Destekli CV Analizi"),
            &String::from_str(&env, "Yapay Zeka"),
            &String::from_str(&env, "Bilgisayar Bilimleri Kulubu"),
            &String::from_str(&env, "bafy-scholarpass-demo"),
        );

        assert_eq!(id, 1);
        assert_eq!(client.get_achievement_count(&student), 1);

        let achievements = client.get_achievements(&student);
        assert_eq!(achievements.first().unwrap().id, 1);
    }

    #[test]
    fn admin_can_authorize_new_issuer() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ScholarPassContract, ());
        let client = ScholarPassContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let issuer = Address::generate(&env);

        client.initialize(&admin);
        assert!(!client.is_issuer(&issuer));

        client.add_issuer(&issuer);
        assert!(client.is_issuer(&issuer));

        client.remove_issuer(&issuer);
        assert!(!client.is_issuer(&issuer));
    }
}
