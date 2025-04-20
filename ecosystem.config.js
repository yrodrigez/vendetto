/**
 * ecosystem.config.js — PM2 manifest for the “vendetto” Discord bot
 */
module.exports = {
    apps: [
        {
            // ----------- WHAT TO RUN ----------
            name: 'vendetto',              // Human‑friendly id in pm2 ls
            script: 'dist/index.js',       // Entry point after `tsc`
            // If you prefer ts-node in prod, use:
            // script: 'src/index.ts',
            // interpreter: 'node',         // ts-node/register set via NODE_OPTIONS below

            // ----------- HOW TO RUN ----------
            args: '--dns-result-order=ipv4first',
            instances: 1,                  // Or 'max' for cluster mode
            autorestart: true,
            watch: false,                  // Set true if you want file‑change reloads

            // Restart if mem > 500MB to avoid runaway leaks
            max_memory_restart: '500M',

            // ----------- ENVIRONMENTS ----------
            env: {
                // default environment (NODE_ENV=development)
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production',
                SUPABASE_URL: process.env.SUPABASE_URL,      // read from host env / secrets
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
            },

            // ----------- LOGGING ----------
            error_file: '~/.pm2/logs/vendetto-error.log',
            out_file:   '~/.pm2/logs/vendetto-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm Z'
        }
    ]
}
