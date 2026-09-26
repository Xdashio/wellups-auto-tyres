"use client";
import { useEffect, useState } from "react";
import { publicSupabase } from "@/lib/supabase/catalog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [verifyDialog, setVerifyDialog] = useState<any>(null);
  const [rejectDialog, setRejectDialog] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const load = async () => {
    const { data, error } = await publicSupabase.rpc("staff_get_payment_queue");
    if (!error) setPayments(data || []);
  };
  useEffect(() => {
    load();
  }, []);
  const verify = async (id: string) => {
    await publicSupabase.rpc("staff_verify_payment", { p_payment_id: id });
    setVerifyDialog(null);
    load();
  };
  const reject = async (id: string) => {
    if (!rejectReason.trim()) return;
    await publicSupabase.rpc("staff_reject_payment", { p_payment_id: id, p_rejection_reason: rejectReason });
    setRejectDialog(null);
    setRejectReason("");
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
                    <Button size="sm" variant="outline" onClick={() => setVerifyDialog(p)} className="mr-2">Verify</Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectDialog(p)}>Reject</Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={!!verifyDialog} onOpenChange={() => setVerifyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
          </DialogHeader>
          {verifyDialog && (
            <div className="space-y-2 text-sm">
              <p>Payment: {verifyDialog.payment_number}</p>
              <p>Quote: {verifyDialog.quote_number}</p>
              <p>Amount: KES {verifyDialog.amount}</p>
              <p>Reference: {verifyDialog.provider_reference}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialog(null)}>Cancel</Button>
            <Button onClick={() => verify(verifyDialog?.id)}>Confirm Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
          </DialogHeader>
          {rejectDialog && (
            <div className="space-y-3">
              <p className="text-sm">Payment: {rejectDialog.payment_number} – {rejectDialog.provider_reference}</p>
              <Input placeholder="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => reject(rejectDialog?.id)} disabled={!rejectReason.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
