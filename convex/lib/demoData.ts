// Demo corpus so the RAG flow works immediately after `loadDemoCorpus`.
//
// IMPORTANT: these are short EDITORIAL SUMMARIES written for the demo (not judgment text, not
// quotations) of well-known Supreme Court decisions, kept deliberately general. Verify against the
// full judgment before relying on any of them. Source links are Indian Kanoon SEARCH links rather
// than guessed document ids. Replace/augment with real judgment text via ingestBulk.
// (Some records intentionally contain OCR-style noise — page numbers, site banners — so the
// cleaning stage is exercised.)
export interface DemoRecord {
  source: string;
  sourceDocId: string;
  caseName: string;
  rawText: string;
  citations?: string[];
  court?: string;
  neutralCitation?: string;
  sourceUrl?: string;
  docType?: string;
}

const ik = (q: string) => `https://indiankanoon.org/search/?formInput=${encodeURIComponent(q)}`;
const NOTE = "Editorial summary (NyayaSetu demo corpus) — verify against the full judgment.";

export const DEMO_CORPUS: DemoRecord[] = [
  {
    source: "demo",
    sourceDocId: "1",
    caseName: "National Insurance Co. Ltd. v. Swaran Singh",
    citations: ["(2004) 3 SCC 297", "AIR 2004 SC 1531"],
    court: "Supreme Court of India",
    sourceUrl: ik("National Insurance Co. Ltd. v. Swaran Singh"),
    rawText:
      `${NOTE}\n\nThe Supreme Court considered when a motor insurer can avoid liability in a third-party ` +
      "accident claim under the Motor Vehicles Act, 1988 by pleading that the driver did not hold a valid " +
      "driving licence. The insurer bears the burden of proving the breach of the policy condition, and must " +
      "also show that the insured owner was at fault, for instance by not taking reasonable care to check the " +
      "driver's licence. A mere technical breach does not automatically discharge the insurer. Page 1 of 12\n\n" +
      "Digitally signed\n\nEven where the insurer's defence succeeds, the Tribunal may direct the insurer to " +
      "pay the award to the third-party victim first and then recover the amount from the owner (the 'pay and " +
      "recover' approach), because the scheme of Section 149 protects third-party victims of commercial and " +
      "private vehicle accidents.",
  },
  {
    source: "demo",
    sourceDocId: "2",
    caseName: "Oriental Insurance Co. Ltd. v. Nanjappan",
    citations: ["(2004) 13 SCC 224"],
    court: "Supreme Court of India",
    sourceUrl: ik("Oriental Insurance Co. Ltd. v. Nanjappan"),
    rawText:
      `${NOTE}\n\nThe case concerned persons travelling as gratuitous passengers in a goods vehicle (a truck) ` +
      "that met with an accident. The Supreme Court held that the insurer was not liable under the policy for " +
      "such passengers. However, to protect the accident victims, the insurer was directed to pay the " +
      "compensation awarded to them and to recover it from the owner of the vehicle, with directions on how " +
      "recovery could be effected, including the owner furnishing security. WWW.SOMECOURT.GOV.IN Page 3 of 9\n\n" +
      "The decision is commonly cited for the pay-and-recover mechanism in Motor Vehicles Act claims where the " +
      "vehicle was used in breach of the policy conditions.",
  },
  {
    source: "demo",
    sourceDocId: "3",
    caseName: "Lucknow Development Authority v. M.K. Gupta",
    citations: ["(1994) 1 SCC 243", "AIR 1994 SC 787"],
    court: "Supreme Court of India",
    sourceUrl: ik("Lucknow Development Authority v. M.K. Gupta"),
    rawText:
      `${NOTE}\n\nThe Supreme Court held that housing construction and allotment by a statutory development ` +
      "authority is a 'service' within the meaning of consumer protection law, so a deficiency in that service " +
      "can be complained of before the consumer fora. Compensation is not limited to the value of goods or " +
      "services; it can include compensation for harassment and mental agony caused by arbitrary or " +
      "oppressive action. Where a public authority's officers act arbitrarily and the public body pays " +
      "compensation, the authority may recover it from the officers responsible. The consumer remedy is in " +
      "addition to, and not in derogation of, other remedies available to the consumer.",
  },
  {
    source: "demo",
    sourceDocId: "4",
    caseName: "Sarla Verma v. Delhi Transport Corporation",
    citations: ["(2009) 6 SCC 121"],
    court: "Supreme Court of India",
    sourceUrl: ik("Sarla Verma v. Delhi Transport Corporation"),
    rawText:
      `${NOTE}\n\nIn a fatal motor accident claim, the Supreme Court set out a structured method for computing ` +
      "compensation for loss of dependency: assess the deceased's income, deduct a portion towards personal " +
      "and living expenses depending on the number of dependants, and apply a multiplier based on the age of " +
      "the deceased. The Court laid down a table of multipliers to bring uniformity and consistency to awards " +
      "made by Motor Accident Claims Tribunals, so that similarly placed claimants are treated alike and " +
      "'just compensation' under the Motor Vehicles Act, 1988 is achieved.",
  },
  {
    source: "demo",
    sourceDocId: "5",
    caseName: "National Insurance Co. Ltd. v. Pranay Sethi",
    citations: ["(2017) 16 SCC 680"],
    court: "Supreme Court of India (Constitution Bench)",
    sourceUrl: ik("National Insurance Co. Ltd. v. Pranay Sethi"),
    rawText:
      `${NOTE}\n\nA Constitution Bench settled how future prospects are added to the income of a deceased ` +
      "victim when computing compensation in motor accident death claims, for both permanently employed and " +
      "self-employed or fixed-wage victims, with the addition decreasing as the age of the deceased increases. " +
      "The Court approved the multiplier method and table in Sarla Verma v. Delhi Transport Corporation, " +
      "(2009) 6 SCC 121, and fixed standard amounts for the conventional heads of loss of estate, loss of " +
      "consortium and funeral expenses, to be enhanced periodically, so that awards across Tribunals are " +
      "consistent.",
  },
  {
    source: "demo",
    sourceDocId: "6",
    caseName: "Indian Medical Association v. V.P. Shantha",
    citations: ["(1995) 6 SCC 651", "AIR 1996 SC 550"],
    court: "Supreme Court of India",
    sourceUrl: ik("Indian Medical Association v. V.P. Shantha"),
    rawText:
      `${NOTE}\n\nThe Supreme Court held that services rendered by medical practitioners and hospitals to a ` +
      "patient for consideration fall within the definition of 'service' under consumer protection law, so " +
      "a patient can complain of deficiency in service, including medical negligence, before the consumer " +
      "fora. Services rendered entirely free of charge to everyone are outside the definition, while free " +
      "services given to some patients by a hospital that charges others remain covered. The Court also " +
      "rejected the argument that consumer fora are unsuited to deciding complicated questions of " +
      "negligence.",
  },
  {
    source: "demo",
    sourceDocId: "7",
    caseName: "Shiv Sarup Gupta v. Dr. Mahesh Chand Gupta",
    citations: ["(1999) 6 SCC 222"],
    court: "Supreme Court of India",
    sourceUrl: ik("Shiv Sarup Gupta v. Mahesh Chand Gupta"),
    rawText:
      `${NOTE}\n\nThe case concerned eviction of a tenant under rent control law on the ground of the ` +
      "landlord's bona fide requirement of the premises. The Supreme Court explained that the requirement " +
      "must be genuine and honest, and more than a mere wish or fanciful desire, assessed in the light of " +
      "the landlord's circumstances. At the same time the landlord is ordinarily the best judge of his own " +
      "requirement, and the court should not dictate to the landlord how and in what manner he should live " +
      "or substitute its own view of what accommodation would be adequate. The tests apply to eviction " +
      "proceedings by a landlord against a tenant.",
  },
  {
    source: "demo",
    sourceDocId: "8",
    caseName: "Dashrath Rupsingh Rathod v. State of Maharashtra",
    citations: ["(2014) 9 SCC 129"],
    court: "Supreme Court of India",
    sourceUrl: ik("Dashrath Rupsingh Rathod v. State of Maharashtra"),
    rawText:
      `${NOTE}\n\nThe Supreme Court addressed which court has territorial jurisdiction to try a complaint for ` +
      "dishonour of a cheque under Section 138 of the Negotiable Instruments Act, 1881, holding that the " +
      "complaint lies where the cheque is dishonoured by the drawee bank. Parliament subsequently amended the " +
      "Act by the Negotiable Instruments (Amendment) Act, 2015, which inserted Section 142(2) so that, for a " +
      "cheque delivered for collection through an account, the complaint can be filed where the branch of the " +
      "payee's bank is situated. Practitioners therefore read this decision together with the 2015 amendment.",
  },
  // ── Criminal / police ──────────────────────────────────────────────────────
  {
    source: "demo",
    sourceDocId: "9",
    caseName: "Lalita Kumari v. Government of Uttar Pradesh",
    citations: ["(2014) 2 SCC 1"],
    court: "Supreme Court of India",
    sourceUrl: ik("Lalita Kumari v. Government of Uttar Pradesh"),
    rawText:
      `${NOTE}\n\nA Constitution Bench held that registration of a First Information Report is mandatory ` +
      "when the information given to the police discloses the commission of a cognizable offence, and no " +
      "preliminary inquiry is permissible in such a situation. Where the information does not clearly disclose " +
      "a cognizable offence, a limited preliminary inquiry may be conducted only to ascertain whether a " +
      "cognizable offence is disclosed, for example in matrimonial disputes, commercial offences, medical " +
      "negligence or cases of abnormal delay, and it should be completed within a short time. Action must be " +
      "taken against officers who do not register an FIR when a cognizable offence is disclosed. The " +
      "principle now applies to Section 173 of the Bharatiya Nagarik Suraksha Sanhita, 2023, which replaced " +
      "Section 154 of the Code of Criminal Procedure and also allows a Zero FIR and electronic information.",
  },
  {
    source: "demo",
    sourceDocId: "10",
    caseName: "Arnesh Kumar v. State of Bihar",
    citations: ["(2014) 8 SCC 273"],
    court: "Supreme Court of India",
    sourceUrl: ik("Arnesh Kumar v. State of Bihar"),
    rawText:
      `${NOTE}\n\nThe Supreme Court cautioned against automatic arrest in offences punishable with ` +
      "imprisonment of up to seven years, including the cruelty offence under Section 498A of the Indian " +
      "Penal Code (now Section 85 of the Bharatiya Nyaya Sanhita, 2023). The police must satisfy themselves " +
      "of the necessity of arrest by reference to the conditions in Section 41 of the Code of Criminal " +
      "Procedure (now Section 35 of the BNSS), record reasons, and use the checklist; a notice of appearance " +
      "should be issued where arrest is not required. A Magistrate authorising detention must peruse the " +
      "reasons recorded and be satisfied. Officers who do not follow the directions are liable to " +
      "departmental action and contempt.",
  },
  {
    source: "demo",
    sourceDocId: "11",
    caseName: "Satender Kumar Antil v. Central Bureau of Investigation",
    citations: ["(2022) 10 SCC 51"],
    court: "Supreme Court of India",
    sourceUrl: ik("Satender Kumar Antil v. Central Bureau of Investigation"),
    rawText:
      `${NOTE}\n\nThe Supreme Court reiterated that bail is the rule and jail the exception, and issued ` +
      "guidelines on the grant of bail. It classified offences into categories and held that where an accused " +
      "was not arrested during investigation and cooperated, and the charge-sheet is filed, the court should " +
      "ordinarily not insist on custody before considering bail. It emphasised compliance with the arrest " +
      "safeguards laid down in Arnesh Kumar, timely disposal of bail applications, and the right of undertrial " +
      "prisoners who have served a long period to be considered for release. It also urged the enactment of a " +
      "separate law on bail.",
  },
  // ── Family / matrimonial ───────────────────────────────────────────────────
  {
    source: "demo",
    sourceDocId: "12",
    caseName: "Rajnesh v. Neha",
    citations: ["(2021) 2 SCC 324"],
    court: "Supreme Court of India",
    sourceUrl: ik("Rajnesh v. Neha"),
    rawText:
      `${NOTE}\n\nThe Supreme Court laid down guidelines on maintenance to a wife and children, which may be ` +
      "claimed under several statutes including Section 125 of the Code of Criminal Procedure (now Section 144 " +
      "of the BNSS), the Protection of Women from Domestic Violence Act, 2005, the Hindu Marriage Act, 1955 and " +
      "the Hindu Adoptions and Maintenance Act, 1956. Both parties must file an affidavit disclosing their " +
      "assets and liabilities in the prescribed format. Where successive claims are made under different laws, " +
      "the court must take into account the maintenance already awarded and may adjust or set it off. " +
      "Maintenance is to be awarded from the date of the application, and the factors include the status of " +
      "the parties, reasonable needs, income and the liabilities of the husband.",
  },
  {
    source: "demo",
    sourceDocId: "13",
    caseName: "Satish Chander Ahuja v. Sneha Ahuja",
    citations: ["(2021) 1 SCC 414"],
    court: "Supreme Court of India",
    sourceUrl: ik("Satish Chander Ahuja v. Sneha Ahuja"),
    rawText:
      `${NOTE}\n\nThe Supreme Court interpreted the definition of shared household under Section 2(s) of the ` +
      "Protection of Women from Domestic Violence Act, 2005 and held that a woman's right of residence under " +
      "Section 17 can extend to a house belonging to the relatives of the husband, such as the father-in-law, " +
      "where she lived in a domestic relationship, and is not limited to property owned or rented by the " +
      "husband. The right of residence is not a right of ownership, and an order for residence can be passed " +
      "in proceedings by the owner seeking possession, after considering the circumstances of the case.",
  },
  // ── Employment / labour ────────────────────────────────────────────────────
  {
    source: "demo",
    sourceDocId: "14",
    caseName: "Deepali Gundu Surwase v. Kranti Junior Adhyapak Mahavidyalaya",
    citations: ["(2013) 10 SCC 324"],
    court: "Supreme Court of India",
    sourceUrl: ik("Deepali Gundu Surwase v. Kranti Junior Adhyapak Mahavidyalaya"),
    rawText:
      `${NOTE}\n\nThe Supreme Court held that where the termination of an employee's service is found to be ` +
      "wrongful or illegal, reinstatement with continuity of service and full back wages is the normal rule. " +
      "If the employer wants to deny back wages, it must plead and prove that the employee was gainfully " +
      "employed during the period of unemployment. The adjudicating authority has discretion to reduce back " +
      "wages having regard to the length of service, the nature of the misconduct found, and the financial " +
      "condition of the employer, but must record reasons for doing so.",
  },
  {
    source: "demo",
    sourceDocId: "15",
    caseName: "Vishaka v. State of Rajasthan",
    citations: ["(1997) 6 SCC 241", "AIR 1997 SC 3011"],
    court: "Supreme Court of India",
    sourceUrl: ik("Vishaka v. State of Rajasthan"),
    rawText:
      `${NOTE}\n\nIn the absence of legislation, the Supreme Court laid down binding guidelines to prevent and ` +
      "redress sexual harassment of women at the workplace, treating it as a violation of the fundamental " +
      "rights to equality and to life and liberty. Employers were required to take preventive steps and to " +
      "set up a complaints committee headed by a woman with an independent member. The guidelines were later " +
      "given statutory form by the Sexual Harassment of Women at Workplace (Prevention, Prohibition and " +
      "Redressal) Act, 2013, which requires an Internal Committee in every workplace with ten or more " +
      "employees and a Local Committee at the district level.",
  },
  // ── Cyber / electronic evidence ────────────────────────────────────────────
  {
    source: "demo",
    sourceDocId: "16",
    caseName: "Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal",
    citations: ["(2020) 7 SCC 1"],
    court: "Supreme Court of India",
    sourceUrl: ik("Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal"),
    rawText:
      `${NOTE}\n\nA three-judge Bench held that the certificate required under Section 65B(4) of the Indian ` +
      "Evidence Act, 1872 is a condition precedent to the admissibility of electronic evidence by way of " +
      "secondary evidence, such as printouts or copies of call records, emails or CCTV footage. The " +
      "certificate is unnecessary where the original device itself is produced. If the person in charge of the " +
      "device refuses to give the certificate, the party may apply to the court to require its production. " +
      "The corresponding provision is now Section 63 of the Bharatiya Sakshya Adhiniyam, 2023, which " +
      "prescribes a certificate in the Schedule.",
  },
  {
    source: "demo",
    sourceDocId: "17",
    caseName: "Shreya Singhal v. Union of India",
    citations: ["(2015) 5 SCC 1", "AIR 2015 SC 1523"],
    court: "Supreme Court of India",
    sourceUrl: ik("Shreya Singhal v. Union of India"),
    rawText:
      `${NOTE}\n\nThe Supreme Court struck down Section 66A of the Information Technology Act, 2000, which ` +
      "penalised sending offensive messages through a computer resource, as unconstitutional for being vague " +
      "and overbroad and an unreasonable restriction on free speech. It upheld Section 69A on blocking of " +
      "online content, subject to its procedural safeguards, and read down Section 79 so that an intermediary " +
      "must take down unlawful content on receiving actual knowledge through a court order or a government " +
      "notification. Online fraud and identity theft continue to be punishable under other provisions such as " +
      "Sections 66C and 66D of the Act.",
  },
  // ── Property ───────────────────────────────────────────────────────────────
  {
    source: "demo",
    sourceDocId: "18",
    caseName: "Suraj Lamp and Industries Pvt. Ltd. v. State of Haryana",
    citations: ["(2012) 1 SCC 656"],
    court: "Supreme Court of India",
    sourceUrl: ik("Suraj Lamp and Industries v. State of Haryana"),
    rawText:
      `${NOTE}\n\nThe Supreme Court held that transfers of immovable property by way of a sale agreement, a ` +
      "general power of attorney and a will (so-called GPA sales or SA/GPA/Will transfers) do not convey title " +
      "and are not a recognised mode of transfer. Title to immovable property can be transferred only by a " +
      "registered deed of conveyance under the Transfer of Property Act, 1882 and the Registration Act, 1908. " +
      "Such documents may at best be relied on in a suit for specific performance or to show possession, and " +
      "genuine transactions entered into earlier may be regularised by executing registered deeds.",
  },
  {
    source: "demo",
    sourceDocId: "19",
    caseName: "Vineeta Sharma v. Rakesh Sharma",
    citations: ["(2020) 9 SCC 1"],
    court: "Supreme Court of India",
    sourceUrl: ik("Vineeta Sharma v. Rakesh Sharma"),
    rawText:
      `${NOTE}\n\nA three-judge Bench held that under Section 6 of the Hindu Succession Act, 1956, as substituted ` +
      "by the Amendment Act of 2005, a daughter is a coparcener by birth in the same manner as a son, with the " +
      "same rights and liabilities. The right does not depend on the father being alive on the date of the " +
      "2005 amendment. An oral partition pleaded as a defence must be supported by public documents and proved " +
      "strictly. Pending suits and appeals were directed to be decided in accordance with this law.",
  },
  // ── Cheque bounce (procedure) ──────────────────────────────────────────────
  {
    source: "demo",
    sourceDocId: "20",
    caseName: "Meters and Instruments Pvt. Ltd. v. Kanchan Mehta",
    citations: ["(2018) 1 SCC 560"],
    court: "Supreme Court of India",
    sourceUrl: ik("Meters and Instruments v. Kanchan Mehta"),
    rawText:
      `${NOTE}\n\nThe Supreme Court observed that the offence under Section 138 of the Negotiable Instruments ` +
      "Act, 1881 is primarily a civil wrong with a compensatory purpose, and that cheque dishonour cases " +
      "should be tried summarily as far as possible. If the accused pays the cheque amount with interest and " +
      "costs as assessed by the court, the court may close the proceedings even without the complainant's " +
      "consent. The Court encouraged compounding at an early stage, evidence on affidavit, and the use of " +
      "electronic means for service of summons.",
  },
];
