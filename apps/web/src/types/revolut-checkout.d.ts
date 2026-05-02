/**
 * Type declarations for @revolut/checkout
 * Phase 54-05: Minimal types to fix build
 */

declare module "@revolut/checkout" {
  interface RevolutCheckoutInstance {
    payWithPopup(options: {
      onSuccess: () => void;
      onError: (error?: { message?: string }) => void;
      onCancel: () => void;
    }): void;
    createCardField(options: { target: HTMLElement }): void;
  }

  interface PaymentRequestInstance {
    canMakePayment(): Promise<string | false>;
    render(): void;
    destroy?(): void;
  }

  interface PaymentsModule {
    paymentRequest(
      target: HTMLElement,
      options: {
        currency: string;
        amount: number;
        requestShipping: boolean;
        createOrder: () => Promise<{ publicId: string }>;
        onSuccess: () => void;
        onError: (error?: { message?: string }) => void;
        onCancel: () => void;
        buttonStyle?: {
          radius?: string;
          variant?: string;
          size?: string;
        };
      }
    ): PaymentRequestInstance;
  }

  interface RevolutCheckoutNamespace {
    (orderToken: string, mode: "sandbox" | "prod"): Promise<RevolutCheckoutInstance>;
    payments(options: {
      publicToken: string;
      locale: string;
      mode: "sandbox" | "prod";
    }): Promise<PaymentsModule>;
  }

  const RevolutCheckout: RevolutCheckoutNamespace;

  export default RevolutCheckout;
}
