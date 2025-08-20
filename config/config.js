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
CONFIG.db_port      = process.env.DB_PORT || 5432;
CONFIG.db_name      = process.env.DB_NAME || "hrcrm";
CONFIG.db_user      = process.env.DB_USER || "postgres";
CONFIG.db_password  = process.env.DB_PASSWORD || "1622";
CONFIG.db_usePassword = (process.env.DB_USE_PASSWORD || "true") === "true";


CONFIG.godaddyBaseUrl = process.env.GODADDY_BASE_URL;
CONFIG.godaddyApiKey = process.env.GODADDY_API_KEY;
CONFIG.godaddyApiSecret = process.env.GODADDY_API_SECRET;

// Mail (GoDaddy SMTP)
CONFIG.mailService = process.env.MAIL_SERVICE;
CONFIG.mailUser = process.env.MAIL_USER;
CONFIG.mailPassword = process.env.MAIL_PASSWORD;
CONFIG.mailHost = process.env.MAIL_HOST;
CONFIG.mailPort = process.env.MAIL_PORT;
CONFIG.mailSecure = process.env.MAIL_SECURE;


module.exports = CONFIG;  // <-- ✅ export it
