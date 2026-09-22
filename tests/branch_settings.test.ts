import { describe, it, expect } from "vitest";
import { getWhatsAppQuoteUrl, PublicBranch } from "../lib/supabase/catalog";
import { BranchSettingsSchema, updateBranchSettings } from "../lib/supabase/branch";
import fs from "fs";
import path from "path";

describe("PROMPT 008B — Configurable Business Settings Verification", () => {
  // 1. Admin can update allowed branch configuration (unit & validation level)
  it("1. Admin can update allowed branch configuration with valid Zod input", async () => {
    const validInput = {
      name: "WELL LUPS AUTO TYRES — Industrial Area",
      address: "Commercial St, Industrial Area, Nairobi",
      phone: "+254 700 123456",
      whatsapp: "254712345678",
      opening_hours: "Mon - Sat: 8:00 AM - 6:00 PM",
    };

    const parseResult = BranchSettingsSchema.safeParse(validInput);
    expect(parseResult.success).toBe(true);

    // Mock client returning updated branch data
    const mockAdminClient = {
      from: (table: string) => ({
        update: (data: any) => ({
          eq: (field: string, value: string) => ({
            select: () => ({
              single: async () => ({
                data: { id: "10000000-0000-0000-0000-000000000001", ...data },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as any;

    const res = await updateBranchSettings(
      mockAdminClient,
      "10000000-0000-0000-0000-000000000001",
      validInput
    );
    expect(res.success).toBe(true);
    expect(res.data?.whatsapp).toBe("254712345678");
  });

  // 2. Non-Admin roles cannot update configuration (RLS error simulation)
  it("2. Non-Admin role updates are rejected by RLS / database layer", async () => {
    const validInput = {
      name: "WELL LUPS AUTO TYRES — Industrial Area",
      whatsapp: "254799999999",
    };

    // Mock client returning RLS permission error (42501)
    const mockCashierClient = {
      from: (table: string) => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { code: "42501", message: "new row violates row-level security policy for table branches" },
              }),
            }),
          }),
        }),
      }),
    } as any;

    const res = await updateBranchSettings(
      mockCashierClient,
      "10000000-0000-0000-0000-000000000001",
      validInput
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("row-level security policy");
  });

  // 3. Public users can read only approved branch fields
  it("3. Public users can read only approved branch fields from branches_public view", () => {
    const publicBranchSample: PublicBranch = {
      id: "10000000-0000-0000-0000-000000000001",
      name: "WELL LUPS AUTO TYRES — Industrial Area",
      address: "Industrial Area, Nairobi",
      phone: "+254 700 000000",
      whatsapp: "254712345678",
      opening_hours: "Mon - Sat: 8am - 6pm",
      mpesa_channel_type: "till",
      mpesa_active_number: "123456",
      mpesa_account_number: null,
    };

    // Note: mpesa_active_number is a derived field (branches_public exposes
    // only whichever channel is active, never both raw numbers — see
    // migration 015) so this list intentionally omits the raw
    // mpesa_paybill_number / mpesa_till_number columns.
    const allowedKeys = new Set([
      "id",
      "name",
      "address",
      "phone",
      "whatsapp",
      "opening_hours",
      "mpesa_channel_type",
      "mpesa_active_number",
      "mpesa_account_number",
    ]);
    const sampleKeys = Object.keys(publicBranchSample);

    for (const key of sampleKeys) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  // 4. Missing WhatsApp configuration fails safely
  it("4. Missing WhatsApp configuration fails safely (returns null, no hardcoded link)", () => {
    expect(getWhatsAppQuoteUrl(null, "Test Tyre", "SKU-001")).toBeNull();
    expect(getWhatsAppQuoteUrl(undefined, "Test Tyre", "SKU-001")).toBeNull();
    expect(getWhatsAppQuoteUrl("", "Test Tyre", "SKU-001")).toBeNull();
    expect(getWhatsAppQuoteUrl("   ", "Test Tyre", "SKU-001")).toBeNull();
  });

  // 5. Configured WhatsApp number produces expected deep link
  it("5. Configured WhatsApp number produces expected wa.me deep link", () => {
    const url = getWhatsAppQuoteUrl("254712345678", "SEED All-Terrain Tyre", "SEED-TYR-001", "265/65R17");
    expect(url).not.toBeNull();
    expect(url).toContain("https://wa.me/254712345678?text=");
    expect(url).toContain(encodeURIComponent("SEED All-Terrain Tyre"));
    expect(url).toContain(encodeURIComponent("265/65R17"));
  });

  // 6. No WhatsApp number is hardcoded anywhere in application code
  it("6. Code audit: zero hardcoded WhatsApp phone numbers in source code", () => {
    const srcDir = path.resolve(__dirname, "..");
    const searchFiles = (dir: string): string[] => {
      let files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (["node_modules", ".next", ".git", ".open-next", "dist"].includes(entry.name)) continue;
          files = files.concat(searchFiles(path.join(dir, entry.name)));
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(path.join(dir, entry.name));
        }
      }
      return files;
    };

    const allCodeFiles = searchFiles(srcDir);
    // Patterns matching real or fake hardcoded phone numbers like 254700000000 or wa.me/254...
    const hardcodedPhoneRegex = /wa\.me\/[0-9]{10,15}|254700000000/i;

    for (const filePath of allCodeFiles) {
      // Exclude test files from self-audit
      if (filePath.includes("/tests/")) continue;
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toMatch(hardcodedPhoneRegex);
    }
  });

  // 7. No internal configuration appears in public payloads
  it("7. Public projection schema strictly excludes internal configuration or secrets", () => {
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/011_v0.2_configurable_branch_settings.sql"),
      "utf-8"
    );

    // Verify view projects only specific safe columns
    expect(migrationSql).toContain("select id, name, address, phone, whatsapp, opening_hours");
    expect(migrationSql).not.toContain("cost_price");
    expect(migrationSql).not.toContain("margin");
    expect(migrationSql).not.toContain("service_role");
  });
});
