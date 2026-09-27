import { getApiHealth } from '@/lib/api-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  return getApiHealth(process.env.API_INTERNAL_URL ?? 'http://localhost:3001');
}
