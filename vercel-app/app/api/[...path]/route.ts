import {createGateway} from '../../../lib/gateway.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const handler = (request: Request) => createGateway({backendUrl:process.env.NOOR_BACKEND_URL,backendToken:process.env.NOOR_BACKEND_TOKEN})(request);
export const GET = handler;
export const POST = handler;
