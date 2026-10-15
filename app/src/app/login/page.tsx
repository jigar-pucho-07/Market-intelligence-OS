import { redirect } from 'next/navigation';
import LoginPage from '@/screens/LoginPage';
import { currentUser } from '@/lib/auth';
import { homeFor } from '@/config/roles';
import { otpAvailable } from '@/lib/flows';

export const dynamic = 'force-dynamic';
export default async function Login() {
  const user = await currentUser().catch(() => null);
  if (user) redirect(homeFor(user.role));
  return <LoginPage otpAvailable={otpAvailable()} />;   // the code option is offered only when a workflow can deliver it (S6)
}
