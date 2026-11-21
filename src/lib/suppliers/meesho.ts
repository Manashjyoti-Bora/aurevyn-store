import type {
  SupplierAdapter,
  SupplierCapabilities,
  SupplierCreateOrderInput,
  SupplierCreateOrderResult,
  SupplierOrderStatusResult,
  SupplierActionResult,
  SupplierStockResult,
  Supplier,
} from './types';
import { ManualAdapter } from './manual';

/**
 * Public Meesho search URL for a product name. Used only as a sourcing
 * shortcut for the owner - the store never scrapes or republishes Meesho
 * catalogue data, and nothing here is shown to customers.
 */
export function meeshoSearchUrl(query: string): string {
  return `https://www.meesho.com/search?q=${encodeURIComponent(query.trim())}`;
}

/**
 * Meesho sourcing adapter.
 *
 * Meesho is where a large share of Indian resellers actually buy stock, and it
 * has no public ordering API. Pretending otherwise would produce fake
 * "accepted by supplier" states, so this adapter is honest by design:
 *
 *  - createOrder(): accepts the work into the manual queue and returns a
 *    copy-ready purchase sheet (items, quantities, supplier SKUs) so the owner
 *    can place the exact order in the Meesho app in under a minute.
 *  - Everything else (status, tracking, cancel, return, refund) is maintained
 *    through admin actions, never invented.
 *
 * The sheets are generated from real order data only.
 */
export class MeeshoAdapter implements SupplierAdapter {
  readonly type = 'MEESHO';
  readonly label = 'Meesho (own sourcing — manual placement)';

  readonly capabilities: SupplierCapabilities = {
    catalogSync: false,
    stockCheck: false,
    // A supplier order is a real internal queue entry the owner must place.
    orderCreation: true,
    statusPolling: false,
    tracking: false,
    cancellation: false,
    returns: false,
    refunds: false,
    webhooks: false,
  };

  private manual: ManualAdapter;

  constructor(private supplier: Supplier) {
    this.manual = new ManualAdapter(supplier);
  }

  async checkStock(_supplierSku: string, _quantity: number): Promise<SupplierStockResult> {
    // Stock on Meesho listings is not exposed to us; the seller keeps real
    // LOCAL stock counts in the store, which is what checkout uses.
    return { inStock: true, unverified: true };
  }

  async createOrder(input: SupplierCreateOrderInput): Promise<SupplierCreateOrderResult> {
    // Each line carries a ready Meesho search link, so placing the order is a
    // tap-tap-verify job instead of retyping product names and buying the
    // wrong listing (the main source of reselling losses).
    const lines = input.items
      .map(
        (i) =>
          `• ${i.name} — qty ${i.quantity} — supplier ref ${i.supplierSku}${i.unitCostPaise ? ` — ₹${(i.unitCostPaise / 100).toFixed(2)} each` : ''}\n  search: ${meeshoSearchUrl(i.name)}`
      )
      .join('\n');
    const address = input.shippingAddress;
    const sheet = [
      `MEESHO PURCHASE SHEET — ${input.orderNumber}`,
      '',
      'Items',
      lines,
      '',
      'Ship to',
      address.fullName,
      `${address.line1}${address.line2 ? `, ${address.line2}` : ''}`,
      `${address.city}, ${address.state} ${address.postalCode}`,
      address.phone,
      '',
      `Payment mode on store: ${input.paymentMethod}`,
      `Place this order in the Meesho app, then record the courier and tracking number in Admin → Supplier orders.`,
    ].join('\n');

    return {
      accepted: true,
      supplierOrderId: null,
      status: 'PENDING',
      message:
        `Queued for manual placement on Meesho. Purchase sheet ready for ${input.orderNumber} (${input.items.length} line${input.items.length === 1 ? '' : 's'}).`,
      raw: {
        meeshoManual: true,
        idempotencyKey: input.idempotencyKey,
        purchaseSheet: sheet,
        itemCount: input.items.length,
        totalPaise: input.totalPaise ?? null,
      },
    };
  }

  async getOrderStatus(supplierOrderId: string): Promise<SupplierOrderStatusResult> {
    return this.manual.getOrderStatus(supplierOrderId);
  }

  async getShipmentTracking(supplierOrderId: string): Promise<SupplierOrderStatusResult> {
    return this.manual.getOrderStatus(supplierOrderId);
  }

  async cancelOrder(supplierOrderId: string, reason?: string): Promise<SupplierActionResult> {
    return this.manual.cancelOrder(supplierOrderId, reason);
  }

  async requestReturn(supplierOrderId: string, reason: string): Promise<SupplierActionResult> {
    return this.manual.requestReturn(supplierOrderId, reason);
  }

  async requestRefund(
    supplierOrderId: string,
    amountPaise: number,
    reason: string
  ): Promise<SupplierActionResult> {
    return this.manual.requestRefund(supplierOrderId, amountPaise, reason);
  }
}
