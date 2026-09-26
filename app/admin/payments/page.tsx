"use client";
import { useEffect, useState } from "react";
import { publicSupabase } from "@/lib/supabase/catalog";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const load = async () => {
    const { data, error } = await publicSupabase.rpc("staff_get_payment_queue");
    if (!error) setPayments(data || []);
  };
  useEffect(() => {
    load();
  }, []);
  const verify = async (id: string) => {
    await publicSupabase.rpc("staff_verify_payment", { p_payment_id: id });
    load();
  };
  const reject = async (id: string) => {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    await publicSupabase.rpc("staff_reject_payment", { p_payment_id: id, p_rejection_reason: reason });
    load();
  };
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Payment Queue</h1>
      <table className="w-full text-sm">
        <thead><tr><th>Payment</th><th>Quote</th><th>Amount</th><th>Status</th><th>Ref</th><th>Submitted</th><th>Actions</th></tr></thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-t">
              <td>{p.payment_number}</td>
              <td>{p.quote_number}</td>
              <td>{p.amount}</td>
              <td>{p.status}</td>
              <td>{p.provider_reference}</td>
              <td>{new Date(p.created_at).toLocaleString()}</td>
              <td>
                {p.status === 'pending_verification' && (
                  <>
                    <button onClick={() => verify(p.id)} className="mr-2 text-green-600">Verify</button>
                    <button onClick={() => reject(p.id)} className="text-red-600">Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
