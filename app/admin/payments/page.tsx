"use client";
import { useEffect, useState } from "react";
import { publicSupabase } from "@/lib/supabase/catalog";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  useEffect(() => {
    async function load() {
      const { data, error } = await publicSupabase.rpc("staff_get_payment_queue");
      if (!error) setPayments(data || []);
    }
    load();
  }, []);
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Payment Queue</h1>
      <table className="w-full text-sm">
        <thead><tr><th>Payment</th><th>Quote</th><th>Amount</th><th>Status</th><th>Ref</th><th>Submitted</th></tr></thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-t">
              <td>{p.payment_number}</td>
              <td>{p.quote_number}</td>
              <td>{p.amount}</td>
              <td>{p.status}</td>
              <td>{p.provider_reference}</td>
              <td>{new Date(p.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
