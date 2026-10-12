declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GATEWAY_TOKEN?: string;
    FILE_SIGNING_KEY?: string;
    MAINTENANCE_KEY?: string;
    ADMIN_SETUP_KEY?: string;
    BOG_ENV?: string;
    BOG_CLIENT_ID?: string;
    BOG_CLIENT_SECRET?: string;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    RESEND_API_KEY?: string;
    OPENAI_API_KEY?: string;
    OPENAI_IMAGE_MODEL?: string;
  }
}
