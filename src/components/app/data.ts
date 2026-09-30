export type Slide = {
  n: number;
  title: string;
  body: string[];
  keyTerms: string[];
  highYield: string;
  diagram?: "layers" | "tube" | "crest" | "somites";
};

export const lecture = {
  course: "Embryology",
  chapter: "Chapter 3: Neurulation & Early Neural Development",
  faculty: "Faculty of Medicine · Sétif 1",
  slides: [
    {
      n: 12,
      title: "The notochord and neural induction",
      body: [
        "During the third week, the notochordal process extends cranially from the primitive node between the ectoderm and endoderm, forming the definitive notochord.",
        "The notochord secretes signalling molecules — chiefly Sonic hedgehog (SHH), chordin, noggin and follistatin — that inhibit BMP-4 in the overlying ectoderm.",
        "Ectoderm in which BMP-4 is inhibited is induced to thicken into the neural plate: this is primary neural induction.",
      ],
      keyTerms: ["Notochord", "SHH", "BMP-4 inhibition", "Neural plate"],
      highYield: "The notochord INDUCES the neural plate; it does not form it. In adults it persists only as the nucleus pulposus.",
      diagram: "layers",
    },
    {
      n: 13,
      title: "Formation of the neural tube",
      body: [
        "The lateral edges of the neural plate elevate to form neural folds, with a neural groove in the midline.",
        "Folds approach each other and fuse, beginning in the future cervical region (day 22) and proceeding cranially and caudally.",
        "The cranial neuropore closes around day 25 and the caudal neuropore around day 28. Failure of closure causes neural tube defects.",
      ],
      keyTerms: ["Neural folds", "Neural groove", "Neuropores", "Day 25 / Day 28"],
      highYield: "Anencephaly = failed cranial neuropore closure; spina bifida = failed caudal closure. ↑ AFP and acetylcholinesterase in amniotic fluid.",
      diagram: "tube",
    },
    {
      n: 14,
      title: "Neural crest cells",
      body: [
        "As the neural folds fuse, cells at their lateral crests undergo epithelial-to-mesenchymal transition and migrate away: the neural crest.",
        "Derivatives include dorsal root and autonomic ganglia, Schwann cells, melanocytes, adrenal medulla (chromaffin cells), pia and arachnoid, odontoblasts and the aorticopulmonary septum.",
        "Defects of neural crest migration cause Hirschsprung disease, DiGeorge-related conotruncal anomalies and Waardenburg syndrome.",
      ],
      keyTerms: ["EMT", "Melanocytes", "Adrenal medulla", "Hirschsprung"],
      highYield: "Neural tube → CNS (brain, spinal cord, retina). Neural crest → PNS, melanocytes, adrenal medulla. A classic EMD comparison.",
      diagram: "crest",
    },
    {
      n: 15,
      title: "Paraxial mesoderm and somites",
      body: [
        "Paraxial mesoderm beside the neural tube segments into somitomeres, then somites, from day 20 at a rate of about 3 pairs per day.",
        "Each somite differentiates into a sclerotome (vertebrae, ribs), myotome (skeletal muscle) and dermatome (dermis of the back).",
        "About 42–44 pairs form; somite counts are used to estimate embryonic age during week 4.",
      ],
      keyTerms: ["Somites", "Sclerotome", "Myotome", "Dermatome"],
      highYield: "Sclerotome cells surround the notochord to form vertebral bodies; the notochord between them becomes the nucleus pulposus.",
      diagram: "somites",
    },
    {
      n: 16,
      title: "Teratology of the neural tube",
      body: [
        "Neural tube defects are among the most common congenital malformations; the critical window is weeks 3–4, often before pregnancy is recognised.",
        "Risk factors: folate deficiency, maternal diabetes, obesity, valproate and carbamazepine exposure.",
        "Periconceptional folic acid (0.4 mg/day; 4–5 mg/day for high risk) reduces incidence by up to 70%.",
      ],
      keyTerms: ["Folate", "Valproate", "Weeks 3–4", "AFP"],
      highYield: "Valproate inhibits folate absorption → NTD risk. Start folic acid before conception.",
    },
  ] as Slide[],
};

export type Difficulty = "Easy" | "Medium" | "Hard";
export type Question = {
  id: string;
  subject: string;
  /** lesson / chapter */
  topic: string;
  difficulty: Difficulty;
  source?: string;
  stem: string;
  options: string[];
  answer: number;
  why: string;
  distractors: string[];
  slide: number;
};

const embryo: Omit<Question, "subject" | "difficulty">[] = [
  {
    id: "q1",
    topic: "Neurulation",
    stem: "A 3-week embryo is studied in the lab. Inhibition of BMP-4 in the dorsal ectoderm is experimentally blocked. Which structure normally mediates this inhibition to initiate neurulation?",
    options: ["Primitive streak", "Notochord", "Neural crest", "Amnion"],
    answer: 1,
    why: "The notochord secretes chordin, noggin and SHH, which antagonise BMP-4 and induce the overlying ectoderm to form the neural plate.",
    distractors: [
      "The primitive streak generates mesoderm during gastrulation but does not directly induce the neural plate.",
      "",
      "Neural crest cells arise after neural fold elevation; they are a product of neurulation, not its inducer.",
      "The amnion is an extra-embryonic membrane with no inductive role on dorsal ectoderm.",
    ],
    slide: 12,
  },
  {
    id: "q2",
    topic: "Neurulation",
    stem: "A newborn has an open lumbosacral lesion with exposed neural tissue. Prenatal amniotic fluid would most likely have shown elevated levels of:",
    options: ["hCG", "Alpha-fetoprotein", "Estriol", "Inhibin A"],
    answer: 1,
    why: "Open neural tube defects leak AFP (and acetylcholinesterase) into the amniotic fluid and maternal serum.",
    distractors: [
      "hCG is elevated in trisomy 21 screening, not open NTDs.",
      "",
      "Estriol is typically decreased in trisomies; it is not a marker for NTDs.",
      "Inhibin A rises in trisomy 21, not neural tube defects.",
    ],
    slide: 13,
  },
  {
    id: "q3",
    topic: "Neurulation",
    stem: "Failure of the cranial neuropore to close around day 25 results in which malformation?",
    options: ["Spina bifida occulta", "Anencephaly", "Holoprosencephaly", "Dandy-Walker malformation"],
    answer: 1,
    why: "Anencephaly results from failed closure of the cranial (rostral) neuropore, leaving the forebrain undeveloped.",
    distractors: [
      "Spina bifida occulta is a failed caudal fusion of vertebral arches, usually with intact tissue.",
      "",
      "Holoprosencephaly is a failure of prosencephalon cleavage, linked to SHH mutations.",
      "Dandy-Walker involves cerebellar vermis agenesis with a cystic 4th ventricle.",
    ],
    slide: 13,
  },
  {
    id: "q4",
    topic: "Neural crest",
    stem: "A child presents with chronic constipation and a distended abdomen; rectal biopsy shows absent ganglion cells. The affected cells are derived from:",
    options: ["Neural tube", "Neural crest", "Surface ectoderm", "Endoderm"],
    answer: 1,
    why: "Hirschsprung disease is due to failed migration of neural crest cells forming the myenteric and submucosal plexuses.",
    distractors: [
      "The neural tube forms the CNS, not enteric ganglia.",
      "",
      "Surface ectoderm forms epidermis, lens and enamel.",
      "Endoderm forms the gut epithelium, not its neurons.",
    ],
    slide: 14,
  },
  {
    id: "q5",
    topic: "Neural crest",
    stem: "Which of the following is NOT a neural crest derivative?",
    options: ["Melanocytes", "Adrenal medulla", "Retina", "Schwann cells"],
    answer: 2,
    why: "The retina is an outgrowth of the diencephalon, i.e. neural tube (neuroectoderm).",
    distractors: [
      "Melanocytes are classic neural crest derivatives.",
      "Chromaffin cells of the adrenal medulla derive from neural crest.",
      "",
      "Schwann cells derive from neural crest.",
    ],
    slide: 14,
  },
  {
    id: "q6",
    topic: "Somite formation",
    stem: "Vertebral bodies are derived from which part of the somite?",
    options: ["Dermatome", "Myotome", "Sclerotome", "Intermediate mesoderm"],
    answer: 2,
    why: "Sclerotome cells migrate around the notochord and neural tube to form vertebrae and ribs.",
    distractors: [
      "Dermatome forms the dermis of the back.",
      "Myotome forms skeletal musculature.",
      "",
      "Intermediate mesoderm forms the urogenital system, not somites.",
    ],
    slide: 15,
  },
  {
    id: "q7",
    topic: "Somite formation",
    stem: "In the adult, the only remnant of the notochord is found in the:",
    options: ["Annulus fibrosus", "Nucleus pulposus", "Filum terminale", "Ligamentum flavum"],
    answer: 1,
    why: "The notochord persists between vertebral bodies as the nucleus pulposus of intervertebral discs.",
    distractors: [
      "The annulus fibrosus derives from sclerotome.",
      "",
      "The filum terminale is a pial extension (neural crest / neural tube related).",
      "Ligamentum flavum is connective tissue of sclerotomal origin.",
    ],
    slide: 15,
  },
  {
    id: "q8",
    topic: "Teratology",
    stem: "A 26-year-old woman with epilepsy plans pregnancy. Which antiepileptic carries the highest risk of neural tube defects?",
    options: ["Lamotrigine", "Levetiracetam", "Valproate", "Phenytoin"],
    answer: 2,
    why: "Valproate interferes with folate metabolism and has the highest NTD risk (~1–2%).",
    distractors: [
      "Lamotrigine has a comparatively low teratogenic risk.",
      "Levetiracetam is considered one of the safest in pregnancy.",
      "",
      "Phenytoin causes fetal hydantoin syndrome (craniofacial, nail hypoplasia), less NTD risk.",
    ],
    slide: 16,
  },
  {
    id: "q9",
    topic: "Teratology",
    stem: "The recommended periconceptional folic acid dose for a woman with a previous NTD-affected pregnancy is:",
    options: ["0.4 mg/day", "1 mg/week", "4–5 mg/day", "No supplementation"],
    answer: 2,
    why: "High-risk women (prior NTD, valproate, diabetes) should take 4–5 mg/day starting before conception.",
    distractors: [
      "0.4 mg/day is the standard low-risk dose.",
      "Weekly dosing is not recommended.",
      "",
      "Supplementation is strongly indicated.",
    ],
    slide: 16,
  },
  {
    id: "q10",
    topic: "Neurulation",
    stem: "Neural tube closure begins in which region of the embryo?",
    options: ["Cranial end", "Future cervical region", "Caudal end", "Lumbar region"],
    answer: 1,
    why: "Fusion starts at the level of the future cervical region (4th–6th somites) around day 22 and proceeds bidirectionally.",
    distractors: [
      "The cranial end closes later (day 25) via the cranial neuropore.",
      "",
      "The caudal neuropore is the last to close (day 28).",
      "Lumbar closure occurs late, near the caudal neuropore.",
    ],
    slide: 13,
  },
];

const DIFF: Record<string, Difficulty> = { q1: "Hard", q2: "Medium", q3: "Easy", q4: "Medium", q5: "Easy", q6: "Easy", q7: "Easy", q8: "Medium", q9: "Medium", q10: "Hard" };

const mk = (id: string, subject: string, topic: string, difficulty: Difficulty, slide: number, stem: string, options: string[], answer: number, why: string, distractors: string[]): Question => ({ id, subject, topic, difficulty, slide, stem, options, answer, why, distractors });

export const questions: Question[] = [
  ...embryo.map((q) => ({ ...q, subject: "Embryology", difficulty: DIFF[q.id] ?? "Medium" })),
  mk("q11", "Embryology", "Gastrulation", "Medium", 10, "During week 3, epiblast cells migrate through the primitive streak. Which germ layer is formed FIRST by this migration?", ["Ectoderm", "Definitive endoderm", "Intraembryonic mesoderm", "Hypoblast"], 1, "The first epiblast cells to invaginate displace the hypoblast and form the definitive endoderm; later cells form mesoderm.", ["Ectoderm is the epiblast that remains on the surface.", "", "Mesoderm forms from cells migrating after the endoderm.", "The hypoblast is displaced, not formed, during gastrulation."]),
  mk("q12", "Embryology", "Gastrulation", "Hard", 10, "A newborn has a sacrococcygeal mass containing hair, teeth and gut tissue. This results from persistence of the:", ["Notochord", "Primitive streak", "Neural crest", "Allantois"], 1, "Sacrococcygeal teratoma arises from remnants of the pluripotent primitive streak.", ["Notochord remnants give chordoma.", "", "Neural crest remnants do not form trigerminal teratomas.", "Allantois remnants form urachal anomalies."]),
  mk("q13", "Embryology", "Gastrulation", "Easy", 10, "Gastrulation establishes which of the following?", ["Two germ layers", "Three germ layers", "The neural tube", "The placenta"], 1, "Gastrulation converts the bilaminar disc into a trilaminar disc: ectoderm, mesoderm, endoderm.", ["Two layers exist before gastrulation (week 2).", "", "The neural tube forms later by neurulation.", "The placenta is extra-embryonic."]),
  mk("q14", "Anatomy", "Upper limb", "Medium", 4, "After a midshaft humeral fracture, a patient cannot extend the wrist (wrist drop). Which nerve is injured?", ["Median nerve", "Ulnar nerve", "Radial nerve", "Axillary nerve"], 2, "The radial nerve runs in the spiral groove of the humerus and supplies the wrist extensors.", ["Median nerve injury gives ape hand / loss of thumb opposition.", "Ulnar nerve injury gives claw hand.", "", "Axillary nerve injury (surgical neck) weakens deltoid abduction."]),
  mk("q15", "Anatomy", "Upper limb", "Easy", 5, "Which muscle is NOT part of the rotator cuff?", ["Supraspinatus", "Teres major", "Infraspinatus", "Subscapularis"], 1, "The rotator cuff is SITS: supraspinatus, infraspinatus, teres minor, subscapularis.", ["Supraspinatus is part of SITS.", "", "Infraspinatus is part of SITS.", "Subscapularis is part of SITS."]),
  mk("q16", "Anatomy", "Thorax", "Medium", 8, "A chest drain is inserted in the 5th intercostal space. To avoid the neurovascular bundle it should pass:", ["Just below a rib", "Just above a rib", "Through the middle of the space", "Behind the rib"], 1, "The intercostal vein, artery and nerve run in the costal groove at the inferior border of each rib.", ["Passing just below a rib hits the neurovascular bundle.", "", "Mid-space placement risks collateral branches.", "Not an anatomical approach."]),
  mk("q17", "Physiology", "Action potential", "Easy", 3, "The depolarisation phase of a neuronal action potential is due to:", ["K+ efflux", "Na+ influx", "Cl- influx", "Ca2+ efflux"], 1, "Voltage-gated Na+ channels open, and Na+ rushes in down its electrochemical gradient.", ["K+ efflux causes repolarisation.", "", "Cl- influx hyperpolarises.", "Ca2+ efflux does not generate the neuronal upstroke."]),
  mk("q18", "Physiology", "Action potential", "Hard", 4, "During the absolute refractory period, a second action potential cannot be triggered because:", ["K+ channels are closed", "Na+ channels are inactivated", "The Na+/K+ pump stops", "The membrane is hyperpolarised"], 1, "Inactivation gates of voltage-gated Na+ channels are closed until the membrane repolarises.", ["K+ channels are open, not closed, during repolarisation.", "", "The pump is too slow to matter on this time scale.", "Hyperpolarisation belongs to the relative refractory period."]),
  mk("q19", "Physiology", "Cardiac cycle", "Medium", 7, "The first heart sound (S1) corresponds to closure of the:", ["Aortic and pulmonary valves", "Mitral and tricuspid valves", "Mitral and aortic valves", "Pulmonary valve only"], 1, "S1 marks the start of ventricular systole with closure of the atrioventricular valves.", ["Semilunar valve closure gives S2.", "", "These valves do not close together.", "Pulmonary closure contributes to S2."]),
  mk("q20", "Histology", "Epithelia", "Easy", 2, "The epithelium lining the urinary bladder is:", ["Simple squamous", "Stratified squamous keratinised", "Transitional (urothelium)", "Pseudostratified ciliated"], 2, "Urothelium stretches with umbrella cells that tolerate bladder distension.", ["Simple squamous lines vessels and alveoli.", "Keratinised epithelium is the epidermis.", "", "Pseudostratified ciliated lines the airways."]),
  mk("q21", "Histology", "Epithelia", "Medium", 3, "Which junction forms a seal preventing paracellular diffusion?", ["Desmosome", "Gap junction", "Zonula occludens", "Hemidesmosome"], 2, "Tight junctions (zonula occludens, claudins/occludin) seal the intercellular space.", ["Desmosomes provide mechanical adhesion.", "Gap junctions allow communication.", "", "Hemidesmosomes anchor cells to the basement membrane."]),
];

export type Card = { id: string; front: string; back: string; tip: string; topic: string; source?: string };

export const seedCards: Card[] = [
  { id: "c1", topic: "Neurulation", front: "Main function of the notochord?", back: "Induces overlying ectoderm to form the neural plate (via SHH, chordin, noggin).", tip: "Induces — does not form — the neural tube." },
  { id: "c2", topic: "Neurulation", front: "When does the cranial neuropore close?", back: "Around day 25.", tip: "Failure → anencephaly." },
  { id: "c3", topic: "Neurulation", front: "When does the caudal neuropore close?", back: "Around day 28.", tip: "Failure → spina bifida." },
  { id: "c4", topic: "Neural crest", front: "Name 4 neural crest derivatives.", back: "Melanocytes, adrenal medulla, Schwann cells, DRG / autonomic ganglia.", tip: "Mnemonic: MOTEL PASS." },
  { id: "c5", topic: "Neural crest", front: "Hirschsprung disease is due to?", back: "Failed neural crest migration to the distal colon.", tip: "Absent Meissner & Auerbach plexuses." },
  { id: "c6", topic: "Somites", front: "Sclerotome forms?", back: "Vertebrae and ribs.", tip: "Myotome → muscle; dermatome → dermis." },
  { id: "c7", topic: "Somites", front: "Adult remnant of the notochord?", back: "Nucleus pulposus.", tip: "Classic one-liner EMD question." },
  { id: "c8", topic: "Teratology", front: "Marker elevated in open NTDs?", back: "AFP and acetylcholinesterase.", tip: "In amniotic fluid and maternal serum." },
  { id: "c9", topic: "Teratology", front: "AED with highest NTD risk?", back: "Valproate.", tip: "Inhibits folate absorption." },
  { id: "c10", topic: "Teratology", front: "Folic acid dose for high-risk women?", back: "4–5 mg/day, periconceptional.", tip: "Low-risk: 0.4 mg/day." },
  { id: "c11", topic: "Neurulation", front: "Molecule antagonised to induce neural plate?", back: "BMP-4.", tip: "Default ectoderm fate = epidermis." },
  { id: "c12", topic: "Neural crest", front: "Neural tube vs neural crest: retina?", back: "Neural tube (diencephalon outgrowth).", tip: "Frequently used distractor." },
];

export const subjects = [
  { name: "Anatomy", pct: 84, n: 142 },
  { name: "Physiology", pct: 76, n: 98 },
  { name: "Histology", pct: 71, n: 64 },
  { name: "Embryology", pct: 61, n: 57 },
  { name: "Biochemistry", pct: 68, n: 40 },
];
