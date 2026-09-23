import React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StaffAuthGate } from "@/components/admin/staff-auth-gate";
import { POSTerminal } from "@/components/pos/pos-terminal";
import { handleLoadPOSProducts, handleCheckout } from "@/app/pos/actions";

export const revalidate = 0;

export default async function POSPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Point of Sale"
        description="Process in-shop counter sales. Stock deductions and totals are calculated authoritatively by the database."
      />

      <StaffAuthGate context="Sign in as a staff member (Cashier, Manager, Admin) to operate the POS terminal." />

      <POSTerminal
        onLoadProducts={handleLoadPOSProducts}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
