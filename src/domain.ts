export interface Booking {
  id: string; agencyId: string; groupId: string; totalMinor: number;
  paidMinor: number; currency: string; missingDocuments: string[];
  status: 'active' | 'cancelled';
}
export interface Scope { userId: string; agencyId: string; role: 'owner' | 'admin' | 'agent'; groupIds: string[] }
export function needsAttention(booking: Booking, scope: Scope): boolean {
  const accessible = booking.agencyId === scope.agencyId &&
    (scope.role !== 'agent' || scope.groupIds.includes(booking.groupId));
  return accessible && booking.status === 'active' &&
    booking.totalMinor > booking.paidMinor && booking.missingDocuments.length > 0;
}
export function remainingMinor(booking: Booking): number {
  for (const value of [booking.totalMinor, booking.paidMinor]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid monetary amount');
  }
  return Math.max(0, booking.totalMinor - booking.paidMinor);
}
