/** Product-owned transport contract. Types only: safe for the public form and private inbox. */
export interface EnquiryInput {
  requestId: string;
  language: 'en' | 'sv' | 'da';
  name: string;
  email: string;
  phone: string;
  location: string;
  contactPeriod: '' | 'morning' | 'afternoon' | 'evening';
  notes: string;
  service: 'pool' | 'pond' | 'stream' | 'unsure';
  packageId: 'glade' | 'summer' | 'horizon' | 'unsure';
  siteId: 'open' | 'limited' | 'complex' | 'unsure';
  sizeId: 'included' | 'larger' | 'expansive';
  featureIds: string[];
  annualCare: boolean;
}
/** A form owns its validation. Persistence only requires email and bounded, versioned fields. */
export interface EnquiryField {
  id: string;
  label: string;
  value: string;
}
export interface EnquirySubmission {
  requestId: string;
  email: string;
  name?: string;
  language?: 'en' | 'sv' | 'da';
  formVersion: string;
  fields: EnquiryField[];
}
export interface EnquiryNotification {
  state: 'queued' | 'sending' | 'sent' | 'failed' | 'uncertain' | 'historical';
  revision: number;
  attempts: number;
  recipient: string | null;
  messageId: string | null;
}
export interface CustomerRecord {
  id: string;
  email: string;
  name: string;
  status: 'lead' | 'customer';
  revision: number;
  createdAt: string;
  updatedAt: string;
  enquiries: EnquiryRecord[];
}
export type EnquiryStatus = 'new' | 'contacted' | 'closed';
export interface EnquiryRecord {
  requestId: string;
  email: string;
  name: string;
  language: 'en' | 'sv' | 'da';
  customerId: string;
  formVersion: string;
  fields: EnquiryField[];
  notification: EnquiryNotification;
  status: EnquiryStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface EnquiryService {
  submit(value: unknown): { id: string };
  list(): EnquiryRecord[];
  customers(): CustomerRecord[];
  updateCustomer(id: string, value: unknown): CustomerRecord;
  retryNotification(id: string, value: unknown): void;
  resolveNotification(id: string, value: unknown): void;
  update(id: string, value: unknown): EnquiryRecord;
}
