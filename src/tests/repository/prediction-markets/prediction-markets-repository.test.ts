import { DatabaseClient } from "@/infrastructure/database/db";
import { PredictionMarketsRepository } from "@/infrastructure/persistance/repositories/evx/prediction-markets.repository";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { Client } from 'pg'

async function createTestDatabaseClient() {
    const container = await (new PostgreSqlContainer('postgres:16-alpine')
        .start());

    const dbClient = new Client({
        connectionString: container.getConnectionUri()
    });

    await dbClient.connect()

    const client = {
        query: async <T>(text: string, params?: any[]): Promise<T[]> => {
            const result = await dbClient.query(text, params);
            return result.rows as unknown as T[];
        },
        end: async () => {
            await dbClient.end();
            await container.stop();
        },
        pool: {} as any,
    } as unknown as DatabaseClient & { end: () => Promise<void> };

    return { database: container, client };
}

async function createTables(client: DatabaseClient) {
    client.query(`
        CREATE SCHEMA IF NOT EXISTS evx;
        DROP TABLE IF EXISTS evx.prediction_markets;
        DROP TABLE IF EXISTS evx.prediction_outcomes;
        DROP TABLE IF EXISTS evx.prediction_pledges;
        DROP TABLE IF EXISTS evx.wallets;

         CREATE OR REPLACE FUNCTION gen_random_uuid()
        RETURNS uuid
        LANGUAGE sql
        AS $$
            SELECT (
            lpad(to_hex(floor(random() * 4294967295)::bigint), 8, '0') || '-' ||
            lpad(to_hex(floor(random() * 65535)::bigint), 4, '0') || '-' ||
            '4' || substr(lpad(to_hex(floor(random() * 4095)::bigint), 3, '0'), 1, 3) || '-' ||
            substr('89ab', floor(random() * 4)::int + 1, 1) ||
            substr(lpad(to_hex(floor(random() * 4095)::bigint), 3, '0'), 1, 3) || '-' ||
            lpad(to_hex(floor(random() * 281474976710655)::bigint), 12, '0')
            )::uuid
        $$;


        CREATE TABLE evx.prediction_markets (
            reset_id TEXT,
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL,
            closes_at TIMESTAMPTZ NOT NULL,
            resolved_outcome_id TEXT,
            created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            type TEXT NOT NULL
        );
        

        CREATE TABLE evx.prediction_outcomes (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            market_id TEXT NOT NULL,
            label TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            FOREIGN KEY (market_id) REFERENCES evx.prediction_markets(id)
        );

        CREATE TABLE evx.prediction_pledges (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            market_id TEXT NOT NULL,
            outcome_id TEXT NOT NULL,
            wallet_id TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            FOREIGN KEY (market_id) REFERENCES evx.prediction_markets(id),
            FOREIGN KEY (outcome_id) REFERENCES evx.prediction_outcomes(id)
        );

        CREATE TABLE evx.wallets (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT NOT NULL,
            balance NUMERIC NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL
        );


    `);
}

async function seedPredictionMarkets(db: DatabaseClient) {
    db.query(`
        -- 40 wallets
        INSERT INTO evx.wallets (id, user_id, balance, created_at, updated_at) VALUES
        ('wallet-1', 'user-1', 1000, NOW(), NOW()),
        ('wallet-2', 'user-2', 1000, NOW(), NOW()),
        ('wallet-3', 'user-3', 1000, NOW(), NOW()),
        ('wallet-4', 'user-4', 1000, NOW(), NOW()),
        ('wallet-5', 'user-5', 1000, NOW(), NOW()),
        ('wallet-6', 'user-6', 1000, NOW(), NOW()),
        ('wallet-7', 'user-7', 1000, NOW(), NOW()),
        ('wallet-8', 'user-8', 1000, NOW(), NOW()),
        ('wallet-9', 'user-9', 1000, NOW(), NOW()),
        ('wallet-10', 'user-10', 1000, NOW(), NOW()),
        ('wallet-11', 'user-11', 1000, NOW(), NOW()),
        ('wallet-12', 'user-12', 1000, NOW(), NOW()),
        ('wallet-13', 'user-13', 1000, NOW(), NOW()),
        ('wallet-14', 'user-14', 1000, NOW(), NOW()),
        ('wallet-15', 'user-15', 1000, NOW(), NOW()),
        ('wallet-16', 'user-16', 1000, NOW(), NOW()),
        ('wallet-17', 'user-17', 1000, NOW(), NOW()),
        ('wallet-18', 'user-18', 1000, NOW(), NOW()),
        ('wallet-19', 'user-19', 1000, NOW(), NOW()),
        ('wallet-20', 'user-20', 1000, NOW(), NOW()),
        ('wallet-21', 'user-21', 1000, NOW(), NOW()),
        ('wallet-22', 'user-22', 1000, NOW(), NOW()),
        ('wallet-23', 'user-23', 1000, NOW(), NOW()),
        ('wallet-24', 'user-24', 1000, NOW(), NOW()),
        ('wallet-25', 'user-25', 1000, NOW(), NOW()),
        ('wallet-26', 'user-26', 1000, NOW(), NOW()),
        ('wallet-27', 'user-27', 1000, NOW(), NOW()),
        ('wallet-28', 'user-28', 1000, NOW(), NOW()),
        ('wallet-29', 'user-29', 1000, NOW(), NOW()),
        ('wallet-30', 'user-30', 1000, NOW(), NOW()),
        ('wallet-31', 'user-31', 1000, NOW(), NOW()),
        ('wallet-32', 'user-32', 1000, NOW(), NOW()),
        ('wallet-33', 'user-33', 1000, NOW(), NOW()),
        ('wallet-34', 'user-34', 1000, NOW(), NOW()),
        ('wallet-35', 'user-35', 1000, NOW(), NOW()),
        ('wallet-36', 'user-36', 1000, NOW(), NOW()),
        ('wallet-37', 'user-37', 1000, NOW(), NOW()),
        ('wallet-38', 'user-38', 1000, NOW(), NOW()),
        ('wallet-39', 'user-39', 1000, NOW(), NOW()),
        ('wallet-40', 'user-40', 1000, NOW(), NOW());
        
        -- 15 prediction markets
        INSERT INTO evx.prediction_markets (id, reset_id, title, description, status, closes_at, resolved_outcome_id, created_by, created_at, updated_at, type) VALUES
        ('market-1', 'reset-1', 'Will it rain tomorrow?', 'Predict if it will rain tomorrow in New York City.', 'OPEN', NOW() + INTERVAL '1 day', NULL, 'user-1', NOW(), NOW(), 'YES_NO'),
        ('market-2', 'reset-1', 'Who will win the next World Cup?', 'Predict the winner of the next FIFA World Cup.', 'OPEN', NOW() + INTERVAL '30 days', NULL, 'user-2', NOW(), NOW(), 'MULTIPLE_CHOICE'),
        ('market-3', 'reset-1', 'Will the stock market go up tomorrow?', 'Predict if the S&P 500 will close higher tomorrow.', 'OPEN', NOW() + INTERVAL '1 day', NULL, 'user-3', NOW(), NOW(), 'YES_NO'),
        ('market-4', 'reset-2', 'Which team will win the Super Bowl?', 'Predict the winner of the next Super Bowl.', 'OPEN', NOW() + INTERVAL '60 days', NULL, 'user-4', NOW(), NOW(), 'MULTIPLE_CHOICE'),
        ('market-5', 'reset-2', 'Will Bitcoin reach $100k by the end of the year?', 'Predict if Bitcoin will reach $100,000 by December 31st.', 'OPEN', NOW() + INTERVAL '180 days', NULL, 'user-5', NOW(), NOW(), 'YES_NO'),
        ('market-6', 'reset-3', 'Who will win the next NBA Championship?', 'Predict the winner of the next NBA Championship.', 'OPEN', NOW() + INTERVAL '90 days', NULL, 'user-6', NOW(), NOW(), 'MULTIPLE_CHOICE'),
        ('market-7', 'reset-3', 'Will the next James Bond movie be released in 2024?', 'Predict if the next James Bond movie will be released in 2024.', 'OPEN', NOW() + INTERVAL '120 days', NULL, 'user-7', NOW(), NOW(), 'YES_NO'),
        ('market-8', 'reset-3', 'Which country will win the most medals in the next Olympics?', 'Predict which country will win the most medals in the next Summer Olympics.', 'OPEN', NOW() + INTERVAL '365 days', NULL, 'user-8', NOW(), NOW(), 'MULTIPLE_CHOICE'),
        ('market-9', 'reset-4', 'Will the next iPhone have a foldable screen?', 'Predict if the next iPhone will feature a foldable screen.', 'OPEN', NOW() + INTERVAL '180 days', NULL, 'user-9', NOW(), NOW(), 'YES_NO'),
        ('market-10', 'reset-4', 'Who will win the next Eurovision Song Contest?', 'Predict the winner of the next Eurovision Song Contest.', 'OPEN', NOW() + INTERVAL '200 days', NULL, 'user-10', NOW(), NOW(), 'MULTIPLE_CHOICE'),
        ('market-11', 'reset-4', 'Will the next Marvel movie gross over $1 billion?', 'Predict if the next Marvel movie will gross over $1 billion worldwide.', 'OPEN', NOW() + INTERVAL '150 days', NULL, 'user-11', NOW(), NOW(), 'YES_NO'),
        ('market-12', NULL, 'Which team will win the next UEFA Champions League?', 'Predict the winner of the next UEFA Champions League.', 'OPEN', NOW() + INTERVAL '90 days', NULL, 'user-12', NOW(), NOW(), 'MULTIPLE_CHOICE'),
        ('market-13', NULL, 'Will the next season of Game of Thrones be released in 2024?', 'Predict if the next season of Game of Thrones will be released in 2024.', 'OPEN', NOW() + INTERVAL '120 days', NULL, 'user-13', NOW(), NOW(), 'YES_NO'),
        ('market-14', NULL, 'Which country will win the next FIFA World Cup?', 'Predict which country will win the next FIFA World Cup.', 'OPEN', NOW() + INTERVAL '30 days', NULL, 'user-14', NOW(), NOW(), 'MULTIPLE_CHOICE'),
        ('market-15', NULL, 'Will the next Tesla car model be released in 2024?', 'Predict if the next Tesla car model will be released in 2024.', 'OPEN', NOW() + INTERVAL '180 days', NULL, 'user-15', NOW(), NOW(), 'YES_NO');

        -- 80 outcomes distributed across the markets
        INSERT INTO evx.prediction_outcomes (id, market_id, label, sort_order, created_at) VALUES
        ('outcome-1', 'market-9', 'Yes', 1, NOW()),
        ('outcome-2', 'market-4', 'No', 2, NOW()),
        ('outcome-3', 'market-5', 'Yes', 1, NOW()),
        ('outcome-4', 'market-5', 'No', 2, NOW()),
        ('outcome-5', 'market-14', 'Yes', 1, NOW()),
        ('outcome-6', 'market-14', 'No', 2, NOW()),
        ('outcome-7', 'market-12', 'Yes', 1, NOW()),
        ('outcome-8', 'market-9', 'No', 2, NOW()),
        ('outcome-9', 'market-2', 'Yes', 1, NOW()),
        ('outcome-10', 'market-4', 'No', 2, NOW()),
        ('outcome-11', 'market-8', 'Yes', 1, NOW()),
        ('outcome-12', 'market-4', 'No', 2, NOW()),
        ('outcome-13', 'market-13', 'Yes', 1, NOW()),
        ('outcome-14', 'market-3', 'No', 2, NOW()),
        ('outcome-15', 'market-9', 'Yes', 1, NOW()),
        ('outcome-16', 'market-14', 'No', 2, NOW()),
        ('outcome-17', 'market-1', 'Yes', 1, NOW()),
        ('outcome-18', 'market-14', 'No', 2, NOW()),
        ('outcome-19', 'market-11', 'Yes', 1, NOW()),
        ('outcome-20', 'market-9', 'No', 2, NOW()),
        ('outcome-21', 'market-15', 'Yes', 1, NOW()),
        ('outcome-22', 'market-6', 'No', 2, NOW()),
        ('outcome-23', 'market-6', 'Yes', 1, NOW()),
        ('outcome-24', 'market-8', 'No', 2, NOW()),
        ('outcome-25', 'market-9', 'Yes', 1, NOW()),
        ('outcome-26', 'market-12', 'No', 2, NOW()),
        ('outcome-27', 'market-11', 'Yes', 1, NOW()),
        ('outcome-28', 'market-12', 'No', 2, NOW()),
        ('outcome-29', 'market-10', 'Yes', 1, NOW()),
        ('outcome-30', 'market-5', 'No', 2, NOW()),
        ('outcome-31', 'market-13', 'Yes', 1, NOW()),
        ('outcome-32', 'market-7', 'No', 2, NOW()),
        ('outcome-33', 'market-13', 'Yes', 1, NOW()),
        ('outcome-34', 'market-9', 'No', 2, NOW()),
        ('outcome-35', 'market-11', 'Yes', 1, NOW()),
        ('outcome-36', 'market-8', 'No', 2, NOW()),
        ('outcome-37', 'market-15', 'Yes', 1, NOW()),
        ('outcome-38', 'market-7', 'No', 2, NOW()),
        ('outcome-39', 'market-12', 'Yes', 1, NOW()),
        ('outcome-40', 'market-6', 'No', 2, NOW()),
        ('outcome-41', 'market-12', 'Yes', 1, NOW()),
        ('outcome-42', 'market-7', 'No', 2, NOW()),
        ('outcome-43', 'market-4', 'Yes', 1, NOW()),
        ('outcome-44', 'market-11', 'No', 2, NOW()),
        ('outcome-45', 'market-15', 'Yes', 1, NOW()),
        ('outcome-46', 'market-13', 'No', 2, NOW()),
        ('outcome-47', 'market-2', 'Yes', 1, NOW()),
        ('outcome-48', 'market-2', 'No', 2, NOW()),
        ('outcome-49', 'market-7', 'Yes', 1, NOW()),
        ('outcome-50', 'market-13', 'No', 2, NOW()),
        ('outcome-51', 'market-8', 'Yes', 1, NOW()),
        ('outcome-52', 'market-9', 'No', 2, NOW()),
        ('outcome-53', 'market-6', 'Yes', 1, NOW()),
        ('outcome-54', 'market-1', 'No', 2, NOW()),
        ('outcome-55', 'market-7', 'Yes', 1, NOW()),
        ('outcome-56', 'market-14', 'No', 2, NOW()),
        ('outcome-57', 'market-12', 'Yes', 1, NOW()),
        ('outcome-58', 'market-5', 'No', 2, NOW()),
        ('outcome-59', 'market-2', 'Yes', 1, NOW()),
        ('outcome-60', 'market-3', 'No', 2, NOW()),
        ('outcome-61', 'market-3', 'Yes', 1, NOW()),
        ('outcome-62', 'market-7', 'No', 2, NOW()),
        ('outcome-63', 'market-6', 'Yes', 1, NOW()),
        ('outcome-64', 'market-5', 'No', 2, NOW()),
        ('outcome-65', 'market-10', 'Yes', 1, NOW()),
        ('outcome-66', 'market-10', 'No', 2, NOW()),
        ('outcome-67', 'market-1', 'Yes', 1, NOW()),
        ('outcome-68', 'market-14', 'No', 2, NOW()),
        ('outcome-69', 'market-8', 'Yes', 1, NOW()),
        ('outcome-70', 'market-1', 'No', 2, NOW()),
        ('outcome-71', 'market-10', 'Yes', 1, NOW()),
        ('outcome-72', 'market-1', 'No', 2, NOW()),
        ('outcome-73', 'market-14', 'Yes', 1, NOW()),
        ('outcome-74', 'market-4', 'No', 2, NOW()),
        ('outcome-75', 'market-4', 'Yes', 1, NOW()),
        ('outcome-76', 'market-8', 'No', 2, NOW()),
        ('outcome-77', 'market-14', 'Yes', 1, NOW()),
        ('outcome-78', 'market-12', 'No', 2, NOW()),
        ('outcome-79', 'market-9', 'Yes', 1, NOW()),
        ('outcome-80', 'market-14', 'No', 2, NOW());
        

        -- 150 pledges distributed across the markets
        INSERT INTO evx.prediction_pledges (id, market_id, outcome_id, wallet_id, amount, status, created_at, updated_at) VALUES
        ('pledge-1', 'market-9', 'outcome-25', 'wallet-16', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-2', 'market-1', 'outcome-18', 'wallet-38', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-3', 'market-8', 'outcome-13', 'wallet-14', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-4', 'market-15', 'outcome-26', 'wallet-3', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-5', 'market-2', 'outcome-53', 'wallet-34', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-6', 'market-10', 'outcome-53', 'wallet-4', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-7', 'market-5', 'outcome-24', 'wallet-30', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-8', 'market-2', 'outcome-13', 'wallet-10', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-9', 'market-15', 'outcome-50', 'wallet-23', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-10', 'market-9', 'outcome-4', 'wallet-14', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-11', 'market-2', 'outcome-7', 'wallet-26', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-12', 'market-2', 'outcome-64', 'wallet-25', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-13', 'market-14', 'outcome-56', 'wallet-28', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-14', 'market-5', 'outcome-77', 'wallet-28', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-15', 'market-4', 'outcome-32', 'wallet-4', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-16', 'market-3', 'outcome-52', 'wallet-7', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-17', 'market-1', 'outcome-19', 'wallet-20', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-18', 'market-4', 'outcome-7', 'wallet-22', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-19', 'market-12', 'outcome-37', 'wallet-7', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-20', 'market-9', 'outcome-50', 'wallet-22', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-21', 'market-13', 'outcome-75', 'wallet-21', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-22', 'market-10', 'outcome-33', 'wallet-15', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-23', 'market-2', 'outcome-64', 'wallet-24', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-24', 'market-9', 'outcome-52', 'wallet-3', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-25', 'market-1', 'outcome-69', 'wallet-9', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-26', 'market-7', 'outcome-50', 'wallet-18', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-27', 'market-10', 'outcome-58', 'wallet-22', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-28', 'market-3', 'outcome-32', 'wallet-38', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-29', 'market-7', 'outcome-30', 'wallet-13', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-30', 'market-15', 'outcome-30', 'wallet-28', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-31', 'market-1', 'outcome-10', 'wallet-24', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-32', 'market-5', 'outcome-53', 'wallet-30', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-33', 'market-1', 'outcome-11', 'wallet-27', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-34', 'market-1', 'outcome-36', 'wallet-31', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-35', 'market-13', 'outcome-51', 'wallet-2', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-36', 'market-1', 'outcome-51', 'wallet-8', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-37', 'market-10', 'outcome-73', 'wallet-32', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-38', 'market-15', 'outcome-51', 'wallet-6', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-39', 'market-1', 'outcome-22', 'wallet-34', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-40', 'market-15', 'outcome-48', 'wallet-4', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-41', 'market-4', 'outcome-56', 'wallet-30', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-42', 'market-5', 'outcome-77', 'wallet-16', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-43', 'market-11', 'outcome-42', 'wallet-35', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-44', 'market-5', 'outcome-61', 'wallet-39', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-45', 'market-1', 'outcome-58', 'wallet-34', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-46', 'market-10', 'outcome-35', 'wallet-15', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-47', 'market-9', 'outcome-22', 'wallet-31', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-48', 'market-5', 'outcome-21', 'wallet-30', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-49', 'market-5', 'outcome-65', 'wallet-6', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-50', 'market-1', 'outcome-71', 'wallet-23', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-51', 'market-15', 'outcome-15', 'wallet-8', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-52', 'market-13', 'outcome-18', 'wallet-4', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-53', 'market-6', 'outcome-53', 'wallet-10', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-54', 'market-9', 'outcome-52', 'wallet-37', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-55', 'market-3', 'outcome-52', 'wallet-37', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-56', 'market-15', 'outcome-17', 'wallet-31', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-57', 'market-7', 'outcome-16', 'wallet-32', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-58', 'market-9', 'outcome-40', 'wallet-23', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-59', 'market-2', 'outcome-7', 'wallet-29', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-60', 'market-14', 'outcome-57', 'wallet-32', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-61', 'market-9', 'outcome-44', 'wallet-31', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-62', 'market-8', 'outcome-48', 'wallet-12', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-63', 'market-6', 'outcome-79', 'wallet-30', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-64', 'market-10', 'outcome-51', 'wallet-3', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-65', 'market-2', 'outcome-41', 'wallet-22', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-66', 'market-5', 'outcome-29', 'wallet-4', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-67', 'market-8', 'outcome-45', 'wallet-28', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-68', 'market-5', 'outcome-75', 'wallet-13', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-69', 'market-4', 'outcome-76', 'wallet-19', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-70', 'market-5', 'outcome-15', 'wallet-27', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-71', 'market-15', 'outcome-19', 'wallet-1', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-72', 'market-9', 'outcome-30', 'wallet-37', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-73', 'market-8', 'outcome-69', 'wallet-28', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-74', 'market-1', 'outcome-73', 'wallet-32', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-75', 'market-5', 'outcome-79', 'wallet-7', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-76', 'market-9', 'outcome-19', 'wallet-12', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-77', 'market-9', 'outcome-55', 'wallet-37', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-78', 'market-13', 'outcome-80', 'wallet-35', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-79', 'market-9', 'outcome-59', 'wallet-16', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-80', 'market-1', 'outcome-47', 'wallet-4', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-81', 'market-1', 'outcome-46', 'wallet-18', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-82', 'market-2', 'outcome-29', 'wallet-10', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-83', 'market-3', 'outcome-58', 'wallet-7', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-84', 'market-14', 'outcome-51', 'wallet-14', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-85', 'market-7', 'outcome-56', 'wallet-10', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-86', 'market-15', 'outcome-32', 'wallet-32', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-87', 'market-9', 'outcome-39', 'wallet-25', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-88', 'market-4', 'outcome-55', 'wallet-2', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-89', 'market-12', 'outcome-71', 'wallet-20', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-90', 'market-13', 'outcome-64', 'wallet-40', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-91', 'market-2', 'outcome-67', 'wallet-32', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-92', 'market-12', 'outcome-29', 'wallet-39', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-93', 'market-13', 'outcome-25', 'wallet-16', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-94', 'market-12', 'outcome-54', 'wallet-37', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-95', 'market-7', 'outcome-75', 'wallet-15', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-96', 'market-3', 'outcome-27', 'wallet-26', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-97', 'market-4', 'outcome-79', 'wallet-31', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-98', 'market-4', 'outcome-39', 'wallet-37', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-99', 'market-6', 'outcome-15', 'wallet-30', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-100', 'market-8', 'outcome-16', 'wallet-12', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-101', 'market-14', 'outcome-34', 'wallet-6', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-102', 'market-5', 'outcome-26', 'wallet-7', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-103', 'market-15', 'outcome-67', 'wallet-1', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-104', 'market-6', 'outcome-77', 'wallet-25', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-105', 'market-3', 'outcome-68', 'wallet-33', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-106', 'market-3', 'outcome-20', 'wallet-7', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-107', 'market-14', 'outcome-66', 'wallet-37', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-108', 'market-5', 'outcome-35', 'wallet-40', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-109', 'market-3', 'outcome-21', 'wallet-40', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-110', 'market-14', 'outcome-24', 'wallet-25', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-111', 'market-9', 'outcome-51', 'wallet-25', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-112', 'market-9', 'outcome-59', 'wallet-20', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-113', 'market-10', 'outcome-31', 'wallet-11', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-114', 'market-8', 'outcome-80', 'wallet-27', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-115', 'market-9', 'outcome-39', 'wallet-37', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-116', 'market-4', 'outcome-43', 'wallet-24', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-117', 'market-9', 'outcome-66', 'wallet-37', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-118', 'market-2', 'outcome-77', 'wallet-32', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-119', 'market-3', 'outcome-29', 'wallet-31', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-120', 'market-8', 'outcome-47', 'wallet-20', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-121', 'market-6', 'outcome-2', 'wallet-7', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-122', 'market-7', 'outcome-53', 'wallet-4', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-123', 'market-12', 'outcome-78', 'wallet-17', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-124', 'market-9', 'outcome-48', 'wallet-32', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-125', 'market-12', 'outcome-48', 'wallet-39', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-126', 'market-9', 'outcome-44', 'wallet-9', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-127', 'market-13', 'outcome-12', 'wallet-18', 50, 'ACTIVE', NOW(), NOW()),
        ('pledge-128', 'market-14', 'outcome-52', 'wallet-7', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-129', 'market-9', 'outcome-80', 'wallet-17', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-130', 'market-6', 'outcome-45', 'wallet-3', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-131', 'market-13', 'outcome-39', 'wallet-9', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-132', 'market-10', 'outcome-70', 'wallet-30', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-133', 'market-8', 'outcome-74', 'wallet-8', 100, 'ACTIVE', NOW(), NOW()),
        ('pledge-134', 'market-6', 'outcome-17', 'wallet-10', 500, 'ACTIVE', NOW(), NOW()),
        ('pledge-135', 'market-4', 'outcome-32', 'wallet-29', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-136', 'market-15', 'outcome-7', 'wallet-23', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-137', 'market-6', 'outcome-58', 'wallet-3', 450, 'ACTIVE', NOW(), NOW()),
        ('pledge-138', 'market-4', 'outcome-10', 'wallet-1', 250, 'ACTIVE', NOW(), NOW()),
        ('pledge-139', 'market-14', 'outcome-71', 'wallet-12', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-140', 'market-15', 'outcome-79', 'wallet-10', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-141', 'market-8', 'outcome-63', 'wallet-24', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-142', 'market-2', 'outcome-40', 'wallet-39', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-143', 'market-14', 'outcome-55', 'wallet-36', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-144', 'market-7', 'outcome-54', 'wallet-24', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-145', 'market-14', 'outcome-55', 'wallet-39', 150, 'ACTIVE', NOW(), NOW()),
        ('pledge-146', 'market-5', 'outcome-70', 'wallet-28', 350, 'ACTIVE', NOW(), NOW()),
        ('pledge-147', 'market-3', 'outcome-54', 'wallet-37', 300, 'ACTIVE', NOW(), NOW()),
        ('pledge-148', 'market-5', 'outcome-55', 'wallet-40', 400, 'ACTIVE', NOW(), NOW()),
        ('pledge-149', 'market-14', 'outcome-22', 'wallet-33', 200, 'ACTIVE', NOW(), NOW()),
        ('pledge-150', 'market-13', 'outcome-29', 'wallet-31', 50, 'ACTIVE', NOW(), NOW());
    `);
}



describe('PredictionMarketsRepository', () => {
    let dbClient: DatabaseClient & { end: () => Promise<void> };
    let container: StartedPostgreSqlContainer;

    beforeAll(async () => {
        const { client, database } = await createTestDatabaseClient();
        dbClient = client;
        container = database;

        await dbClient.query(`
            CREATE EXTENSION IF NOT EXISTS pgcrypto;
            CREATE SCHEMA IF NOT EXISTS evx;
        `)

        await createTables(dbClient);
        await seedPredictionMarkets(dbClient);
    })

    afterAll(async () => {
        await dbClient.end();
        await container.stop();
    })


    test('getPopuplarPredictionMarkets returns markets ordered by total participants', async () => {
        const repository = new PredictionMarketsRepository(dbClient);
        const popularMarkets = await repository.getPopularPredictionMarkets();

        expect(popularMarkets).toHaveLength(10);
        expect(popularMarkets[0].totalParticipants).toBeGreaterThanOrEqual(popularMarkets[1].totalParticipants);
        expect(popularMarkets[1].totalParticipants).toBeGreaterThanOrEqual(popularMarkets[2].totalParticipants);
    });

    test('createPredictionMarket creates a new market and returns it', async () => {
        const repository = new PredictionMarketsRepository(dbClient);
        const title = 'Will AI surpass human intelligence by 2030?';
        const description = 'Predict if AI will surpass human intelligence by the year 2030.';
        const closes_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // 1 year from now
        const created_by = 'user-123';
        const type = 'YES_NO';
        const resetId = 'reset-123';
        const newMarket = await repository.createPredictionMarket({
            reset_id: resetId,
            title,
            description,
            closes_at,
            created_by,
            type,
        }, []);

        expect(newMarket).toBeDefined();
        expect(newMarket.id).toBeDefined();
        expect(newMarket.reset_id).toBe(resetId);
        expect(newMarket.title).toBe(title);
        expect(newMarket.description).toBe(description);
        expect(newMarket.closes_at.getTime()).toBe(closes_at.getTime());
        expect(newMarket.created_by).toBe(created_by);
        expect(newMarket.type).toBe(type);
        expect(newMarket.status).toBe('DRAFT');
        expect(newMarket.resolved_outcome_id).toBeNull();
    });

    test('Find markets associated with a specific reset ID', async () => {
        const repository = new PredictionMarketsRepository(dbClient);
        const resetId = 'reset-4';
        const markets = await repository.findMarketsByResetId(resetId);

        expect(markets).toBeDefined();
        expect(Array.isArray(markets)).toBe(true);
        expect(markets).toHaveLength(3);
        markets.forEach(market => {
            expect(market.reset_id).toBe(resetId);
        });
    })
});