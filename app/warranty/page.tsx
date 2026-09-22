import type { Metadata } from "next";
import { getPrimaryBranch } from "@/lib/supabase/catalog";

// DRAFT — NOT PUBLISHED. This page is intentionally NOT linked from the
// Header, Footer, or any nav (verified: no Link to /warranty exists in
// components/layout or app navigation). It is reachable by direct URL only
// so Simon can review the wording. Do not link it until the client signs
// off, and resolve every [CONFIRM] placeholder below first.
//
// Copy rules followed: plain, defensible tyre/auto-parts-retail language;
// manufacturer-warranty pass-through only; no Well Lups-specific policy
// numbers invented — window days, fees, and scope carve-outs are marked
// [CONFIRM] for Simon per docs/PRODUCTION_DATA_INPUTS.md §G.

export const metadata: Metadata = {
  title: "Warranty & Returns",
  description:
    "Draft warranty and returns information for WELL LUPS AUTO TYRES LIMITED. Pending client approval — not yet in effect.",
};

const CONFIRM = "font-semibold text-warning";

export default async function WarrantyPage() {
  const branch = await getPrimaryBranch();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      <div className="border-b pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Warranty &amp; Returns</h1>
        <p className="text-sm text-text-secondary mt-2">
          Draft for review — pending client approval. The terms below take
          effect only once confirmed and published.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Manufacturer warranties</h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          Tyres, batteries, and branded auto parts carry whatever warranty
          the manufacturer offers on that item — we pass it through to you
          unchanged and help you raise the claim. Keep your receipt: every
          warranty claim starts with proof of purchase from us. Warranty
          cover never includes damage from misuse, accidents, incorrect
          fitment elsewhere, or normal wear.
        </p>
        <p className="text-sm leading-relaxed">
          <span className={CONFIRM}>
            [CONFIRM: list any brands whose manufacturer warranty needs a
            registration step, or delete this sentence]
          </span>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Returns &amp; exchanges</h2>
        <ul className="list-disc list-inside space-y-2 text-sm leading-relaxed text-text-secondary">
          <li>
            Unused items in resalable condition — unmounted tyres, unopened
            parts in original packaging — may be returned or exchanged within{" "}
            <span className={CONFIRM}>[CONFIRM: return window, e.g. 7 days]</span>{" "}
            of purchase, with the receipt.
          </li>
          <li>
            Items that have been fitted, mounted, or used cannot be returned
            unless faulty. Ask us to confirm fitment <em>before</em> fitting —
            we check sizing against your vehicle free of charge.
          </li>
          <li>
            Electrical items and items ordered in specially for you are{" "}
            <span className={CONFIRM}>
              [CONFIRM: final sale, or state the exception policy]
            </span>
            .
          </li>
          <li>
            Where a return is accepted outside the standard window, a
            restocking deduction of{" "}
            <span className={CONFIRM}>[CONFIRM: percentage or NONE]</span> may
            apply.
          </li>
          <li>
            Refunds go back by the original payment method wherever possible.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Faulty items</h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          If something we supplied fails early, bring it back with the
          receipt and we will inspect it with you. Genuine defects are
          repaired, replaced, or refunded{" "}
          <span className={CONFIRM}>
            [CONFIRM: choose — repaired / replaced / refunded, or &ldquo;at
            our discretion&rdquo;]
          </span>
          . Failures caused by punctures, kerb damage, misuse, or servicing
          done elsewhere are not covered as faults, but we will always quote
          the repair honestly.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">How to start a return</h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          {branch?.address ? (
            <>Visit us at {branch.address} with the item and receipt. </>
          ) : (
            <>Visit the branch with the item and receipt. </>
          )}
          {branch?.phone || branch?.whatsapp ? (
            <>
              Prefer to check first? Call {branch.phone ?? branch.whatsapp}
              {branch?.whatsapp ? ` or WhatsApp us on ${branch.whatsapp}` : ""}.
            </>
          ) : (
            <>Call or message us first to confirm before travelling.</>
          )}
        </p>
      </section>
    </div>
  );
}
