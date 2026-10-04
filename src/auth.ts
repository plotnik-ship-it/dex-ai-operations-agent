import { timingSafeEqual } from 'node:crypto';
export interface Identity { userId: string; agencyId: string }
export interface DemoAccount extends Identity { token: string }
// Local-only authentication adapter. Replace with an OIDC verifier before hosting.
export function demoAuthenticator(accounts: DemoAccount[]) {
 if(accounts.some(a=>a.token.length<24) || new Set(accounts.map(a=>a.token)).size!==accounts.length) throw new Error('Demo tokens must be unique and at least 24 characters');
 return (authorization: string | undefined): Identity | null => {
  if(!authorization?.startsWith('Bearer ')) return null;
  const token=Buffer.from(authorization.slice(7));
  const account=accounts.find(a=>{const expected=Buffer.from(a.token);return token.length===expected.length && timingSafeEqual(token,expected);});
  return account ? {userId:account.userId,agencyId:account.agencyId} : null;
 };
}
