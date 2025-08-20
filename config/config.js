if (process.env.NODE_ENV !== "production") {
  require("dotenv").config(); // Load .env only in non-production
}

let CONFIG = {};

// General
CONFIG.app = process.env.APP || "dev";
CONFIG.port = process.env.PORT || 3001;

// Database
CONFIG.db_dialect   = process.env.DB_DIALECT || "postgres";
CONFIG.db_host      = process.env.DB_HOST || "localhost";
CONFIG.db_port      = process.env.DB_PORT || 3000;
CONFIG.db_name      = process.env.DB_NAME || "hrdashboard";
CONFIG.db_user      = process.env.DB_USER || "postgres";
CONFIG.db_password  = process.env.DB_PASSWORD || "pass1122me";
CONFIG.db_usePassword = (process.env.DB_USE_PASSWORD || "true") === "true";


module.exports = CONFIG; 
