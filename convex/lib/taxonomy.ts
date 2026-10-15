// Intake taxonomy + path-specific checklists (L1). Shared by the lawyer intake wizard, the citizen
// chatbot's domain routing, lawyer practice areas, and lead matching — one source of truth.
export interface Subcategory {
  key: string;
  label: string;
  checklist: string[];
  suggestedDocTypes: string[];
  researchSeed: string;
}
export interface Category {
  key: string;
  /** Human label; ALSO the practice-area label stored on lawyer profiles. */
  label: string;
  subcategories: Subcategory[];
}

export const TAXONOMY: Category[] = [
  {
    key: "motor_vehicle",
    label: "Motor Vehicle",
    subcategories: [
      {
        key: "accident_claim_loan_dispute",
        label: "Accident Claim + Loan Dispute",
        checklist: [
          "FIR (First Information Report)",
          "Motor Vehicle Inspector (MVI) report",
          "Damage assessment / surveyor report",
          "Insurance policy document",
          "Insurer's claim rejection letter",
          "Vehicle loan agreement",
          "Registration Certificate (RC)",
          "Driving licence of the driver",
          "Repair estimates / invoices",
        ],
        suggestedDocTypes: ["legal_notice", "claim_petition"],
        researchSeed:
          "insurer wrongful repudiation of commercial vehicle accident claim; Motor Vehicles Act; deficiency in service; loan liability during dispute",
      },
      {
        key: "injury_compensation",
        label: "Accident Injury / Death Compensation (MACT)",
        checklist: [
          "FIR / police report of the accident",
          "Medical records, discharge summary and bills",
          "Disability certificate (if any)",
          "Proof of income of the injured / deceased",
          "Age proof of the injured / deceased",
          "Details of the offending vehicle (number, owner, insurer)",
          "Post-mortem report and death certificate (fatal cases)",
        ],
        suggestedDocTypes: ["claim_petition", "legal_notice"],
        researchSeed:
          "compensation to accident victim Motor Accident Claims Tribunal; just compensation; multiplier; future prospects; insurer pay and recover",
      },
    ],
  },
  {
    key: "consumer",
    label: "Consumer Dispute",
    subcategories: [
      {
        key: "deficiency_in_service",
        label: "Deficiency in Service / Defective Goods",
        checklist: [
          "Purchase invoice / receipt",
          "Warranty or service agreement",
          "Correspondence with the service provider",
          "Proof of defect (photos / expert report)",
          "Payment proof",
        ],
        suggestedDocTypes: ["legal_notice", "consumer_complaint"],
        researchSeed:
          "deficiency in service under Consumer Protection Act; unfair trade practice; compensation to consumer",
      },
    ],
  },
  {
    key: "property",
    label: "Property / Tenancy",
    subcategories: [
      {
        key: "eviction_arrears",
        label: "Eviction & Rent Arrears",
        checklist: [
          "Registered rent/lease agreement",
          "Rent payment ledger / receipts",
          "Notice(s) already served on the tenant",
          "Ownership proof / title document",
          "Municipal tax receipts",
        ],
        suggestedDocTypes: ["legal_notice", "written_statement"],
        researchSeed:
          "eviction of tenant for arrears of rent; bona fide requirement; Rent Control Act; ejectment",
      },
      {
        key: "security_deposit",
        label: "Security Deposit Not Returned",
        checklist: [
          "Rent / leave-and-licence agreement",
          "Proof of deposit payment",
          "Handover / move-out evidence (photos, keys receipt)",
          "Messages / emails with the landlord",
        ],
        suggestedDocTypes: ["legal_notice", "demand_letter"],
        researchSeed: "refund of security deposit by landlord; recovery suit; tenancy agreement terms",
      },
    ],
  },
  {
    key: "cheque_bounce",
    label: "Cheque Bounce",
    subcategories: [
      {
        key: "section_138",
        label: "Dishonour of Cheque (NI Act s.138)",
        checklist: [
          "Original dishonoured cheque",
          "Bank return memo (with reason)",
          "Proof of the debt / liability (agreement, invoice, messages)",
          "Copy of the demand notice and postal/courier proof",
        ],
        suggestedDocTypes: ["legal_notice", "complaint"],
        researchSeed:
          "dishonour of cheque section 138 Negotiable Instruments Act; statutory demand notice; legally enforceable debt; presumption section 139",
      },
    ],
  },
  {
    key: "family",
    label: "Family / Matrimonial",
    subcategories: [
      {
        key: "divorce_maintenance",
        label: "Divorce, Maintenance & Custody",
        checklist: [
          "Marriage certificate / wedding proof",
          "Address and identity proof of both spouses",
          "Income proof of both spouses",
          "Details of children (birth certificates, school)",
          "Evidence relevant to the grounds (messages, medical records, complaints)",
        ],
        suggestedDocTypes: ["petition", "legal_notice"],
        researchSeed:
          "maintenance to wife and children; divorce on grounds of cruelty; custody welfare of the child; domestic violence protection",
      },
    ],
  },
  {
    key: "employment",
    label: "Employment / Labour",
    subcategories: [
      {
        key: "unpaid_wages_termination",
        label: "Unpaid Salary / Wrongful Termination",
        checklist: [
          "Offer / appointment letter and employment contract",
          "Salary slips and bank statements",
          "Termination / resignation correspondence",
          "Attendance or work records",
          "Full & final settlement statement (if any)",
        ],
        suggestedDocTypes: ["legal_notice", "demand_letter"],
        researchSeed:
          "non-payment of wages; illegal termination; retrenchment compensation; gratuity; Labour Codes",
      },
    ],
  },
  {
    key: "criminal",
    label: "Criminal / Police",
    subcategories: [
      {
        key: "fir_bail",
        label: "FIR, Police Complaint & Bail",
        checklist: [
          "Copy of the FIR / complaint (or acknowledgement)",
          "Written account of the incident with dates",
          "Names of witnesses",
          "Any medical report, photos or recordings",
          "Arrest memo / charge-sheet (if accused)",
        ],
        suggestedDocTypes: ["complaint", "bail_application"],
        researchSeed:
          "registration of FIR cognizable offence; Bharatiya Nagarik Suraksha Sanhita; anticipatory bail; Magistrate direction to investigate",
      },
    ],
  },
  {
    key: "cyber",
    label: "Cyber Fraud",
    subcategories: [
      {
        key: "online_fraud",
        label: "Online / UPI / Card Fraud",
        checklist: [
          "Transaction IDs, bank/UPI statements",
          "Screenshots of messages, calls, websites used",
          "National Cybercrime Portal / 1930 complaint number",
          "Written complaint to your bank (with date/time)",
        ],
        suggestedDocTypes: ["complaint", "legal_notice"],
        researchSeed:
          "online banking fraud customer liability; unauthorised electronic transaction; Information Technology Act; cheating by personation",
      },
    ],
  },
];

export function getChecklist(categoryKey: string, subKey: string): Subcategory | null {
  const cat = TAXONOMY.find((c) => c.key === categoryKey);
  return cat?.subcategories.find((s) => s.key === subKey) ?? null;
}

export const CATEGORY_KEYS = TAXONOMY.map((c) => c.key);
export const PRACTICE_AREAS = TAXONOMY.map((c) => c.label);

export function categoryLabel(key: string | undefined | null): string {
  if (!key) return "General";
  return TAXONOMY.find((c) => c.key === key)?.label ?? "General";
}

export function categoryKeyFromLabel(label: string): string | null {
  const l = label.toLowerCase().trim();
  return TAXONOMY.find((c) => c.label.toLowerCase() === l || c.key === l)?.key ?? null;
}
