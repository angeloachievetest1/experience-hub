// What a record is called on screen: the customer's name (owner decision
// 2026-09-30: no "QA-0017"-style numbers in tables or panel titles).
export const customerLabel = (r: { customer_name: string | null }) => r.customer_name?.trim() || 'No customer name';
export const requesterLabel = (r: { requester_name: string | null }) => r.requester_name?.trim() || 'No requester';
