import { InvoiceDocument } from '../../../schemas/invoice.schema';

/**
 * PAYMENT PROVIDER INTERFACE
 * 
 * All payment providers must implement this interface.
 * This allows easy switching between providers.
 */

export interface PaymentSessionResult {
  checkoutUrl?: string;
  formData?: Record<string, any>;
  transactionReference: string;
}

export interface PaymentCallbackResult {
  success: boolean;
  externalReference: string;
  invoiceId: string;
  amount: number;
  rawPayload: Record<string, any>;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

export interface PaymentProvider {
  createPaymentSession(invoice: InvoiceDocument): Promise<PaymentSessionResult>;
  parseAndValidateCallback(payload: Record<string, any>): Promise<PaymentCallbackResult>;
}
