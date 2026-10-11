declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GATEWAY_TOKEN?: string;
    FILE_SIGNING_KEY?: string;
    MAINTENANCE_KEY?: string;
    ADMIN_SETUP_KEY?: string;
  }
}
