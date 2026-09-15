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
export type EnquiryStatus = 'new' | 'contacted' | 'closed';
export interface EnquiryRecord extends EnquiryInput {
  status: EnquiryStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface EnquiryService {
  submit(value: unknown): { id: string };
  list(): EnquiryRecord[];
  update(id: string, value: unknown): EnquiryRecord;
}
