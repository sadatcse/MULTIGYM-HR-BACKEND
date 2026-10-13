export interface DefaultLetterTemplateDef {
  letterType: string;
  name: string;
  titleBangla: string;
  titleEnglish: string;
  memoPrefix: string;
  subjectTemplate: string;
  hasEmployeeAcknowledgment: boolean;
  infoFields: Array<{
    key: string;
    labelBangla: string;
    labelEnglish?: string;
    source: 'employee' | 'custom' | 'derived';
    employeeField?: string;
    required: boolean;
    defaultValue?: string;
  }>;
  sections: Array<{
    sectionNumber: string;
    titleBangla: string;
    titleEnglish?: string;
    introText?: string;
    clauses?: string[];
  }>;
}

export const DEFAULT_HR_LETTER_TEMPLATES: DefaultLetterTemplateDef[] = [
  // 1. APPOINTMENT LETTER
  {
    letterType: 'appointment',
    name: 'Standard Appointment Letter',
    titleBangla: 'অফিসিয়াল নিয়োগপত্র',
    titleEnglish: 'Appointment Letter',
    memoPrefix: 'MGP/HR/APT',
    subjectTemplate: 'বিষয়ঃ {{designation}} পদে নিয়োগ প্রদান প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'fatherOrHusbandName', labelBangla: 'পিতা/স্বামীর নাম', source: 'custom', required: false },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / প্রাথমিক শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'joiningDate', labelBangla: 'যোগদানের তারিখ', source: 'employee', employeeField: 'joiningDate', required: true },
      { key: 'monthlySalary', labelBangla: 'মাসিক সর্বমোট বেতন', source: 'custom', required: true },
      { key: 'probationPeriod', labelBangla: 'প্রবেশনকাল', source: 'custom', required: true, defaultValue: '০৩ (তিন) মাস' },
      { key: 'reportingAuthority', labelBangla: 'রিপোর্টিং কর্তৃপক্ষ', source: 'custom', required: true, defaultValue: 'Manager: Admin & HR' },
      { key: 'workHours', labelBangla: 'কর্মঘণ্টা', source: 'custom', required: false, defaultValue: 'প্রতিষ্ঠানের নির্ধারিত সময়সূচি অনুযায়ী' },
      { key: 'weeklyHoliday', labelBangla: 'সাপ্তাহিক ছুটি', source: 'custom', required: false, defaultValue: 'প্রতিষ্ঠানের নীতিমালা অনুযায়ী' },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'নিয়োগপত্র',
        introText: 'আনন্দের সাথে জানানো যাচ্ছে যে, আপনার শিক্ষাগত যোগ্যতা, অভিজ্ঞতা, সাক্ষাৎকারে সন্তোষজনক পারফরম্যান্স এবং প্রতিষ্ঠানের বর্তমান প্রয়োজন বিবেচনা করে আপনাকে Multi Gym Premium & Multi Gym-এ উপরোক্ত পদে নিয়োগ প্রদান করা হলো। আপনার প্রাথমিক কর্মস্থল উপরোক্ত শাখা হলেও প্রতিষ্ঠানের প্রয়োজন অনুসারে Multi Gym Premium & Multi Gym-এর যে কোনো শাখায় সাময়িক বা স্থায়ীভাবে দায়িত্ব প্রদান করা হলে তা যথাযথভাবে পালন করা বাধ্যতামূলক হবে। আপনার নিয়োগ নিম্নোক্ত শর্তাবলীর ভিত্তিতে কার্যকর হবে।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'দায়িত্ব ও কর্তব্য',
        clauses: [
          '(ক) নির্ধারিত সময়ে কর্মস্থলে উপস্থিত থেকে পদের সাথে সংশ্লিষ্ট সকল দৈনন্দিন দায়িত্ব যথাযথভাবে পালন করতে হবে।',
          '(খ) পদের Job Description এবং Management কর্তৃক অনুমোদিত SOP অনুসরণ করতে হবে।',
          '(গ) মেম্বার/সদস্যদের সেবা, নিরাপত্তা ও সন্তুষ্টি নিশ্চিত করতে সর্বোচ্চ পেশাদারিত্ব বজায় রাখতে হবে।',
          '(ঘ) প্রতিষ্ঠানের যন্ত্রপাতি, সরঞ্জাম ও সম্পদের সঠিক ব্যবহার ও সংরক্ষণ নিশ্চিত করতে হবে।',
          '(ঙ) দৈনিক/সাপ্তাহিক/মাসিক রিপোর্ট নির্ধারিত সময়ে রিপোর্টিং কর্তৃপক্ষের নিকট দাখিল করতে হবে।',
          '(চ) নিজ কর্মক্ষেত্রের পরিচ্ছন্নতা, শৃঙ্খলা ও নিরাপত্তা বজায় রাখতে হবে।',
          '(ছ) সহকর্মীদের সাথে সমন্বয় রক্ষা করে দলগতভাবে কাজ করতে হবে।',
          '(জ) জরুরি পরিস্থিতিতে তাৎক্ষণিকভাবে কর্তৃপক্ষকে অবহিত করতে হবে এবং প্রয়োজনে অফিস সময়ের বাইরেও উপস্থিত থাকতে হতে পারে।',
          '(ঝ) প্রতিষ্ঠানের প্রশিক্ষণ, সভা ও উন্নয়নমূলক কার্যক্রমে অংশগ্রহণ করতে হবে।',
          '(ঞ) Management কর্তৃক অর্পিত অন্যান্য যৌক্তিক প্রশাসনিক ও অপারেশনাল দায়িত্ব পালন করতে হবে।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'বেতন, সুবিধা ও মূল্যায়ন',
        clauses: [
          '(ক) মাসিক সর্বমোট বেতন চুক্তি অনুযায়ী নির্ধারিত তারিখে পরিশোধ করা হবে।',
          '(খ) সরকারি বিধি অনুযায়ী প্রযোজ্য কর ও অন্যান্য কর্তন বেতন থেকে কর্তনযোগ্য হবে।',
          '(গ) প্রথম ০৩ (তিন) মাস প্রবেশন পিরিয়ড হিসেবে গণ্য হবে; সন্তোষজনক মূল্যায়নের ভিত্তিতে স্থায়ী নিয়োগ প্রদান করা হবে।',
          '(ঘ) কর্মদক্ষতা, শৃঙ্খলা, উপস্থিতি ও আচরণের ভিত্তিতে বার্ষিক বেতন বৃদ্ধি বিবেচিত হবে।',
          '(ঙ) ছুটি, উৎসব ভাতা ও অন্যান্য সুবিধা প্রতিষ্ঠানের প্রচলিত নীতিমালা অনুযায়ী প্রযোজ্য হবে।',
        ],
      },
      {
        sectionNumber: '৫',
        titleBangla: 'সাধারণ শর্তাবলী',
        clauses: [
          '(ক) প্রতিষ্ঠানের সকল অফিস নির্দেশনা, SOP ও Management Policy মেনে চলতে হবে।',
          '(খ) Attendance Device-এ সঠিক সময়ে উপস্থিতি প্রদান বাধ্যতামূলক। Attendance সংক্রান্ত ভুল তথ্য বা কারসাজি গুরুতর অসদাচরণ হিসেবে গণ্য হবে।',
          '(গ) সকল Member, Visitor ও সহকর্মীর সাথে ভদ্র, সম্মানজনক ও পেশাদার আচরণ বজায় রাখতে হবে।',
          '(ঘ) প্রতিষ্ঠানের ব্যবসায়িক, আর্থিক, সদস্য, HR ও প্রশাসনিক তথ্য সম্পূর্ণ গোপন রাখতে হবে।',
          '(ঙ) প্রতিষ্ঠানের প্রয়োজন অনুসারে কর্মস্থল, শাখা, দায়িত্ব বা কর্মঘণ্টা পরিবর্তন করা যেতে পারে।',
          '(চ) আইডি কার্ড, ইউনিফর্ম, চাবি ও প্রতিষ্ঠানের সম্পদের যথাযথ সংরক্ষণ কর্মচারীর দায়িত্ব।',
          '(ছ) চাকরি ত্যাগের ক্ষেত্রে নীতিমালা অনুযায়ী লিখিত নোটিশ প্রদান এবং সকল সম্পদ ফেরত দিয়ে Clearance গ্রহণ বাধ্যতামূলক।',
          '(জ) চুরি, অসদাচরণ, অনুমোদনহীন অনুপস্থিতি বা প্রতিষ্ঠানের ক্ষতিসাধনে শাস্তিমূলক ব্যবস্থা গ্রহণ করা হবে।',
          '(ঝ) প্রতিষ্ঠানের সকল শাখা CCTV-এর আওতাভুক্ত।',
          '(ঞ) Management-এর লিখিত বা মৌখিক যৌক্তিক নির্দেশনা পালন বাধ্যতামূলক।',
        ],
      },
      {
        sectionNumber: '৬',
        titleBangla: 'যোগদানের সময় দাখিলযোগ্য কাগজপত্র',
        clauses: [
          '(ক) জাতীয় পরিচয়পত্রের সত্যায়িত ফটোকপি — ০২ (দুই) কপি।',
          '(খ) শিক্ষাগত যোগ্যতার সনদপত্রের ফটোকপি।',
          '(গ) পূর্ববর্তী কর্মস্থলের অভিজ্ঞতা সনদ / ছাড়পত্র (প্রযোজ্য ক্ষেত্রে)।',
          '(ঘ) সদ্য তোলা পাসপোর্ট সাইজের ছবি — ০৪ (চার) কপি।',
          '(ঙ) স্থায়ী ও বর্তমান ঠিকানার প্রমাণপত্র এবং জরুরি যোগাযোগের তথ্য।',
          '(চ) জামিনদার/রেফারেন্স সংক্রান্ত তথ্য (প্রযোজ্য ক্ষেত্রে)।',
        ],
      },
    ],
  },

  // 2. CONFIRMATION LETTER
  {
    letterType: 'confirmation',
    name: 'Standard Confirmation Letter',
    titleBangla: 'চাকরি স্থায়ীকরণ পত্র',
    titleEnglish: 'Confirmation Letter',
    memoPrefix: 'MGP/HR/CONF',
    subjectTemplate: 'বিষয়ঃ প্রবেশনকাল সন্তোষজনকভাবে সমাপ্তি ও চাকরি স্থায়ীকরণ প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'joiningDate', labelBangla: 'যোগদানের তারিখ', source: 'employee', employeeField: 'joiningDate', required: true },
      { key: 'probationEndDate', labelBangla: 'প্রবেশনকাল সমাপ্তির তারিখ', source: 'custom', required: true },
      { key: 'confirmationDate', labelBangla: 'স্থায়ীকরণ কার্যকর তারিখ', source: 'custom', required: true },
      { key: 'monthlySalary', labelBangla: 'স্থায়ীকরণ-পরবর্তী মাসিক বেতন', source: 'custom', required: false },
      { key: 'reportingAuthority', labelBangla: 'রিপোর্টিং কর্তৃপক্ষ', source: 'custom', required: false, defaultValue: 'Manager: Admin & HR' },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'পত্রের বিষয়বস্তু',
        introText: 'আনন্দের সাথে জানানো যাচ্ছে যে, Multi Gym Premium & Multi Gym-এ উপরোক্ত পদে আপনার প্রবেশনকাল সন্তোষজনকভাবে সমাপ্ত হয়েছে। আপনার কর্মদক্ষতা, শৃঙ্খলা, উপস্থিতি, আচরণ ও সার্বিক পারফরম্যান্স মূল্যায়ন করে কর্তৃপক্ষ আপনার চাকরি স্থায়ী করার সিদ্ধান্ত গ্রহণ করেছে। অতএব, কার্যকর তারিখ হতে আপনাকে একজন স্থায়ী কর্মী হিসেবে গণ্য করা হলো। এই সিদ্ধান্তের জন্য আপনাকে অভিনন্দন।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'মূল্যায়নের বিবেচ্য বিষয়সমূহ',
        clauses: [
          '(ক) নির্ধারিত দায়িত্ব পালনে দক্ষতা ও নির্ভরযোগ্যতা।',
          '(খ) উপস্থিতি, সময়ানুবর্তিতা ও Attendance রেকর্ড।',
          '(গ) মেম্বার/সদস্য সেবা ও যোগাযোগের মান।',
          '(ঘ) সহকর্মী ও কর্তৃপক্ষের সাথে পেশাদার আচরণ ও সমন্বয়।',
          '(ঙ) প্রতিষ্ঠানের নীতিমালা, SOP ও শৃঙ্খলা পরিপালন।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'স্থায়ীকরণ-পরবর্তী শর্তাবলী',
        clauses: [
          '(ক) পূর্বের নিয়োগপত্রে বর্ণিত সকল শর্তাবলী অপরিবর্তিত থাকবে এবং বহাল বলে গণ্য হবে।',
          '(খ) স্থায়ীকরণের পর ছুটি, উৎসব ভাতা ও অন্যান্য সুবিধা প্রতিষ্ঠানের নীতিমালা অনুযায়ী প্রযোজ্য হবে।',
          '(গ) চাকরি ত্যাগের ক্ষেত্রে প্রতিষ্ঠানের নোটিশ পিরিয়ড সংক্রান্ত বিধি প্রযোজ্য হবে।',
          '(ঘ) বার্ষিক বেতন বৃদ্ধি ও পদোন্নতি কর্মদক্ষতা মূল্যায়নের ভিত্তিতে বিবেচিত হবে।',
          '(ঙ) প্রতিষ্ঠানের প্রয়োজন অনুসারে কর্মস্থল, শাখা, দায়িত্ব বা কর্মঘণ্টা পরিবর্তন করা যেতে পারে।',
          '(চ) Management-এর লিখিত বা মৌখিক যৌক্তিক নির্দেশনা পালন বাধ্যতামূলক।',
        ],
      },
    ],
  },

  // 3. PROMOTION LETTER
  {
    letterType: 'promotion',
    name: 'Standard Promotion Letter',
    titleBangla: 'পদোন্নতি পত্র',
    titleEnglish: 'Promotion Letter',
    memoPrefix: 'MGP/HR/PRO',
    subjectTemplate: 'বিষয়ঃ পদোন্নতি প্রদান প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'previousDesignation', labelBangla: 'বর্তমান পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'newDesignation', labelBangla: 'পদোন্নতিপ্রাপ্ত নতুন পদবী', source: 'custom', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'effectiveDate', labelBangla: 'পদোন্নতি কার্যকর তারিখ', source: 'custom', required: true },
      { key: 'previousSalary', labelBangla: 'পূর্বের মাসিক বেতন', source: 'custom', required: false },
      { key: 'newSalary', labelBangla: 'পদোন্নতি-পরবর্তী মাসিক বেতন', source: 'custom', required: false },
      { key: 'reportingAuthority', labelBangla: 'নতুন রিপোর্টিং কর্তৃপক্ষ', source: 'custom', required: false, defaultValue: 'Manager: Admin & HR' },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'পদোন্নতি প্রদান',
        introText: 'আনন্দের সাথে জানানো যাচ্ছে যে, Multi Gym Premium & Multi Gym-এ আপনার নিষ্ঠা, কর্মদক্ষতা, শৃঙ্খলা, দায়িত্ববোধ ও সন্তোষজনক পারফরম্যান্স বিবেচনা করে কর্তৃপক্ষ আপনাকে উপরোক্ত নতুন পদে পদোন্নতি প্রদানের সিদ্ধান্ত গ্রহণ করেছে। উপরোক্ত কার্যকর তারিখ হতে আপনি নতুন পদের দায়িত্ব গ্রহণ করবেন। আপনার এই অর্জনের জন্য আন্তরিক অভিনন্দন।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'নতুন পদের দায়িত্ব ও কর্তব্য',
        clauses: [
          '(ক) নতুন পদের Job Description অনুযায়ী সকল দায়িত্ব যথাযথভাবে পালন করতে হবে।',
          '(খ) অধীনস্থ কর্মীদের কাজ তদারকি, দিকনির্দেশনা প্রদান ও প্রশিক্ষণে সহায়তা করতে হবে।',
          '(গ) শাখার দৈনন্দিন কার্যক্রম, শৃঙ্খলা, পরিচ্ছন্নতা ও মেম্বার সেবার মান নিশ্চিত করতে হবে।',
          '(ঘ) নির্ধারিত রিপোর্ট, রেজিস্টার ও ডকুমেন্টেশন সঠিকভাবে সংরক্ষণ ও দাখিল করতে হবে।',
          '(ঙ) প্রতিষ্ঠানের লক্ষ্য অর্জনে সক্রিয় ভূমিকা পালন এবং Management-এর সাথে সমন্বয় রক্ষা করতে হবে।',
          '(চ) জরুরি পরিস্থিতিতে দ্রুত সিদ্ধান্ত গ্রহণ ও কর্তৃপক্ষকে অবহিত করতে হবে।',
          '(ছ) Management কর্তৃক অর্পিত অন্যান্য যৌক্তিক দায়িত্ব পালন করতে হবে।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'শর্তাবলী',
        clauses: [
          '(ক) পূর্বের নিয়োগপত্রে বর্ণিত সকল শর্তাবলী, এই পত্র দ্বারা সংশোধিত অংশ ব্যতীত, অপরিবর্তিত থাকবে।',
          '(খ) পদোন্নতি-পরবর্তী বেতন কার্যকর তারিখ হতে প্রযোজ্য হবে।',
          '(গ) নতুন পদের দায়িত্ব পালনে অক্ষমতা বা পারফরম্যান্স সন্তোষজনক না হলে কর্তৃপক্ষ পুনর্বিবেচনার অধিকার সংরক্ষণ করে।',
          '(ঘ) প্রতিষ্ঠানের প্রয়োজন অনুসারে কর্মস্থল, শাখা বা কর্মঘণ্টা পরিবর্তন করা যেতে পারে।',
          '(ঙ) Management-এর লিখিত বা মৌখিক যৌক্তিক নির্দেশনা পালন বাধ্যতামূলক।',
        ],
      },
    ],
  },

  // 4. TRANSFER LETTER
  {
    letterType: 'transfer',
    name: 'Standard Transfer Letter',
    titleBangla: 'বদলি আদেশ পত্র',
    titleEnglish: 'Transfer Letter',
    memoPrefix: 'MGP/HR/TRF',
    subjectTemplate: 'বিষয়ঃ শাখা বদলি প্রদান প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'previousBranch', labelBangla: 'বর্তমান কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'newBranch', labelBangla: 'বদলিকৃত নতুন শাখা', source: 'custom', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'handoverDate', labelBangla: 'বর্তমান শাখায় শেষ কর্মদিবস', source: 'custom', required: true },
      { key: 'effectiveDate', labelBangla: 'নতুন শাখায় যোগদানের তারিখ', source: 'custom', required: true },
      { key: 'reportingAuthority', labelBangla: 'নতুন রিপোর্টিং কর্তৃপক্ষ', source: 'custom', required: false, defaultValue: 'Branch In-Charge / Manager HR' },
      { key: 'transferReason', labelBangla: 'বদলির কারণ', source: 'custom', required: false, defaultValue: 'প্রাতিষ্ঠানিক ও প্রশাসনিক প্রয়োজনে' },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'বদলি আদেশ',
        introText: 'এতদ্বারা জানানো যাচ্ছে যে, প্রতিষ্ঠানের প্রশাসনিক ও অপারেশনাল কার্যপরিচালনার সুবিধার্থে এবং সেবার মান বৃদ্ধির লক্ষ্যে আপনাকে উপরোক্ত বর্তমান শাখা হতে নতুন শাখায় বদলি করার সিদ্ধান্ত গ্রহণ করা হয়েছে। উল্লিখিত কার্যকর তারিখে নতুন শাখায় উপস্থিত হয়ে যোগদান সম্পন্ন করার নির্দেশ প্রদান করা হলো।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'দায়িত্ব হস্তান্তর ও রিপোর্ট প্রদান',
        clauses: [
          '(ক) বর্তমান শাখায় আপনার দায়িত্বাধীন সকল নথিপত্র, সরঞ্জাম, চাবি ও সম্পদ সংশ্লিষ্ট ব্যক্তির নিকট বুঝিয়ে দিতে হবে।',
          '(খ) Handover প্রক্রিয়া সম্পন্ন করে বর্তমান শাখা ইন-চার্জের নিকট হতে Clearance গ্রহণ করতে হবে।',
          '(গ) নির্ধারিত তারিখে নতুন শাখায় যোগদান করে নতুন রিপোর্টিং কর্তৃপক্ষের নিকট রিপোর্ট করতে হবে।',
          '(ঘ) স্থানান্তরের সাথে সংশ্লিষ্ট দায়িত্বসমূহ পেশাদারিত্বের সাথে দ্রুততম সময়ে সম্পন্ন করতে হবে।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'শর্তাবলী',
        clauses: [
          '(ক) কর্মস্থল পরিবর্তন ব্যতীত আপনার বর্তমান পদবী, বেতন ও অন্যান্য চাকুরির শর্তাবলী অপরিবর্তিত থাকবে।',
          '(খ) নতুন শাখার নির্ধারিত শিফট ও কার্যসূচি যথাযথভাবে মেনে চলতে হবে।',
          '(গ) বদলি আদেশ অমান্য করা বা কালক্ষেপণ গুরুতর শৃঙ্খলাভঙ্গ হিসেবে গণ্য হবে।',
          '(ঘ) Management-এর নির্দেশনা পালন বাধ্যতামূলক।',
        ],
      },
    ],
  },

  // 5. PROMOTION & TRANSFER LETTER
  {
    letterType: 'promotion_transfer',
    name: 'Standard Promotion & Transfer Letter',
    titleBangla: 'পদোন্নতি ও বদলি পত্র',
    titleEnglish: 'Promotion & Transfer Letter',
    memoPrefix: 'MGP/HR/PROTRF',
    subjectTemplate: 'বিষয়ঃ পদোন্নতি ও শাখা বদলি প্রদান প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'previousDesignation', labelBangla: 'পূর্বের পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'newDesignation', labelBangla: 'নতুন পদবী', source: 'custom', required: true },
      { key: 'previousBranch', labelBangla: 'পূর্বের শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'newBranch', labelBangla: 'নতুন শাখা', source: 'custom', required: true },
      { key: 'effectiveDate', labelBangla: 'কার্যকর ও যোগদানের তারিখ', source: 'custom', required: true },
      { key: 'previousSalary', labelBangla: 'পূর্বের মাসিক বেতন', source: 'custom', required: false },
      { key: 'newSalary', labelBangla: 'নতুন মাসিক বেতন', source: 'custom', required: false },
      { key: 'reportingAuthority', labelBangla: 'নতুন রিপোর্টিং কর্তৃপক্ষ', source: 'custom', required: false, defaultValue: 'Manager: Admin & HR' },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'সিদ্ধান্ত',
        introText: 'আনন্দের সাথে জানানো যাচ্ছে যে, Multi Gym Premium & Multi Gym-এ আপনার নিষ্ঠা, কর্মদক্ষতা ও পারফরম্যান্সের স্বীকৃতিস্বরূপ আপনাকে উপরোক্ত নতুন পদে পদোন্নতি প্রদান করা হলো এবং প্রাতিষ্ঠানিক প্রয়োজনে নতুন শাখায় বদলি করার সিদ্ধান্ত গ্রহণ করা হলো। আপনার এই দ্বৈত অর্জনে আন্তরিক অভিনন্দন।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'নতুন পদের দায়িত্ব ও শাখা পরিচালনা',
        clauses: [
          '(ক) নতুন পদের আওতাধীন শাখা ব্যবস্থাপনা, তদারকি ও সেবার মান নিশ্চিত করতে হবে।',
          '(খ) অধীনস্থ কর্মীদের পেশাদার দিকনির্দেশনা ও প্রশিক্ষণ প্রদান করতে হবে।',
          '(গ) শাখার নিয়মিত উপস্থিতি, শৃঙ্খলা ও রাজস্ব লক্ষমাত্রা অর্জনে সক্রিয় থাকতে হবে।',
          '(ঘ) সময়মত কেন্দ্রীয় কর্তৃপক্ষের নিকট সার্বিক প্রতিবেদন দাখিল করতে হবে।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'দায়িত্ব হস্তান্তর ও যোগদান',
        clauses: [
          '(ক) পূর্বের শাখার সকল সরঞ্জাম, চাবি ও নথিপত্র যথাযথভাবে হস্তান্তর করতে হবে।',
          '(খ) নির্ধারিত তারিখে নতুন শাখায় উপস্থিত হয়ে দায়িত্বভার গ্রহণ করতে হবে।',
        ],
      },
      {
        sectionNumber: '৫',
        titleBangla: 'শর্তাবলী',
        clauses: [
          '(ক) সংশোধিত পদবী ও বেতন ব্যতীত অন্যান্য সাধারণ চাকুরির শর্তাবলী বহাল থাকবে।',
          '(খ) নতুন দায়িত্ব যথাযথভাবে প্রতিপালনে ব্যর্থ হলে কর্তৃপক্ষ প্রয়োজনীয় সিদ্ধান্ত গ্রহণ করতে পারবে।',
          '(গ) Management-এর নির্দেশনা পরিপালন বাধ্যতামূলক।',
        ],
      },
    ],
  },

  // 6. SALARY REVISION LETTER
  {
    letterType: 'salary_revision',
    name: 'Standard Salary Revision Letter',
    titleBangla: 'বেতন পুনর্নির্ধারণ পত্র',
    titleEnglish: 'Salary Revision Letter',
    memoPrefix: 'MGP/HR/SAL',
    subjectTemplate: 'বিষয়ঃ বেতন পুনর্নির্ধারণ প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'previousSalary', labelBangla: 'পূর্বের মাসিক বেতন', source: 'custom', required: true },
      { key: 'revisedSalary', labelBangla: 'পুনর্নির্ধারিত মাসিক বেতন', source: 'custom', required: true },
      { key: 'effectiveDate', labelBangla: 'কার্যকর তারিখ', source: 'custom', required: true },
      { key: 'revisionReason', labelBangla: 'পুনর্নির্ধারণের কারণ', source: 'custom', required: false, defaultValue: 'কর্মদক্ষতা ও কাজের পরিধি বৃদ্ধির প্রেক্ষিতে' },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'বেতন পুনর্নির্ধারণের সিদ্ধান্ত',
        introText: 'আনন্দের সাথে জানানো যাচ্ছে যে, প্রতিষ্ঠানে আপনার কাজের গুণগত মান, অতিরিক্ত দায়িত্ব পালন ও সামগ্রিক অবদান বিবেচনা করে কর্তৃপক্ষ আপনার মাসিক বেতন পুনর্নির্ধারণ করার সিদ্ধান্ত গ্রহণ করেছে। উল্লিখিত কার্যকর তারিখ হতে আপনার পুনর্নির্ধারিত মাসিক বেতন প্রযোজ্য হবে।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'মূল্যায়নে বিবেচ্য বিষয়সমূহ',
        clauses: [
          '(ক) দায়িত্ব পালনে একাগ্রতা ও নিয়মিত উপস্থিতি।',
          '(খ) সেবার মান ও গ্রাহক সন্তুষ্টি অর্জনে ভূমিকা।',
          '(গ) প্রতিষ্ঠানের প্রতি বিশ্বস্ততা ও নিয়মশৃঙ্খলার প্রতি শ্রদ্ধাশীলতা।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'শর্তাবলী',
        clauses: [
          '(ক) বেতন সংশোধন ব্যতীত চাকুরির পূর্ববর্তী সকল শর্তাবলী অপরিবর্তিত থাকবে।',
          '(খ) বেতন সংক্রান্ত সকল তথ্য প্রতিষ্ঠানের গোপনীয়তার আওতাভুক্ত এবং তা প্রকাশ করা যাবে না।',
          '(গ) প্রযোজ্য ক্ষেত্রে সরকারি কর ও অন্যান্য বিধিবদ্ধ কর্তন প্রযোজ্য হবে।',
        ],
      },
    ],
  },

  // 7. INCREMENT LETTER
  {
    letterType: 'increment',
    name: 'Standard Increment Letter',
    titleBangla: 'বার্ষিক বেতন বৃদ্ধি পত্র',
    titleEnglish: 'Increment Letter',
    memoPrefix: 'MGP/HR/INC',
    subjectTemplate: 'বিষয়ঃ বার্ষিক ইনক্রিমেন্ট প্রদান প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'evaluationPeriod', labelBangla: 'মূল্যায়নকাল', source: 'custom', required: false, defaultValue: 'বার্ষিক মূল্যায়ন' },
      { key: 'previousSalary', labelBangla: 'পূর্বের মাসিক বেতন', source: 'custom', required: true },
      { key: 'incrementAmount', labelBangla: 'ইনক্রিমেন্টের পরিমাণ', source: 'custom', required: true },
      { key: 'incrementPercentage', labelBangla: 'বৃদ্ধির হার (%)', source: 'custom', required: false },
      { key: 'newSalary', labelBangla: 'ইনক্রিমেন্ট-পরবর্তী মাসিক বেতন', source: 'custom', required: true },
      { key: 'effectiveDate', labelBangla: 'কার্যকর তারিখ', source: 'custom', required: true },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'সিদ্ধান্ত',
        introText: 'আনন্দের সাথে জানানো যাচ্ছে যে, উপরোক্ত মূল্যায়নকালে Multi Gym Premium & Multi Gym-এ আপনার কর্মদক্ষতা, উপস্থিতি, শৃঙ্খলা ও সার্বিক পারফরম্যান্স মূল্যায়ন করে কর্তৃপক্ষ আপনাকে বার্ষিক ইনক্রিমেন্ট প্রদানের সিদ্ধান্ত গ্রহণ করেছে। কার্যকর তারিখ হতে পুনর্নির্ধারিত বেতন কার্যকর হবে।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'মূল্যায়নে বিবেচিত বিষয়সমূহ',
        clauses: [
          '(ক) দায়িত্ব পালনে দক্ষতা, গুণগত মান ও নির্ভরযোগ্যতা।',
          '(খ) উপস্থিতি, সময়ানুবর্তিতা ও Attendance রেকর্ড।',
          '(গ) মেম্বার/সদস্য সেবা, যোগাযোগ ও সন্তুষ্টির মান।',
          '(ঘ) শৃঙ্খলা, পেশাদার আচরণ ও প্রতিষ্ঠানের নীতিমালা পরিপালন।',
          '(ঙ) দলগত কাজ, উদ্যোগ ও দায়িত্বের বাইরে অতিরিক্ত অবদান।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'শর্তাবলী',
        clauses: [
          '(ক) ইনক্রিমেন্ট কার্যকর তারিখ হতে প্রযোজ্য হবে।',
          '(খ) পূর্বের চাকুরির শর্তাবলী বহাল থাকবে।',
          '(গ) বেতন ও ইনক্রিমেন্ট সংক্রান্ত তথ্য সম্পূর্ণ গোপনীয় রাখতে হবে।',
          '(ঘ) ভবিষ্যতে দায়িত্ব পালনে অবহেলা দেখা দিলে পরবর্তী সুবিধা পুনর্বিবেচনা করা হবে।',
        ],
      },
    ],
  },

  // 8. WARNING LETTER
  {
    letterType: 'warning',
    name: 'Standard Warning Letter',
    titleBangla: 'সতর্কীকরণ পত্র',
    titleEnglish: 'Warning Letter',
    memoPrefix: 'MGP/HR/WRN',
    subjectTemplate: 'বিষয়ঃ শৃঙ্খলাভঙ্গ / দায়িত্ব পালনে অবহেলার কারণে সতর্কীকরণ প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'incidentDate', labelBangla: 'ঘটনার তারিখ ও সময়', source: 'custom', required: true },
      { key: 'incidentLocation', labelBangla: 'ঘটনার স্থান', source: 'custom', required: false },
      { key: 'warningType', labelBangla: 'সতর্কীকরণের ধরন', source: 'custom', required: true, defaultValue: '১ম লিখিত সতর্কীকরণ' },
      { key: 'incidentDescription', labelBangla: 'অভিযোগের সংক্ষিপ্ত বিবরণ', source: 'custom', required: true },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'অভিযোগের বিবরণ',
        introText: 'অত্যন্ত দুঃখের সাথে জানানো যাচ্ছে যে, উপরোক্ত তারিখে আপনার বিরুদ্ধে সুনির্দিষ্ট বিষয়ে অভিযোগ কর্তৃপক্ষের নিকট উপস্থাপিত হয়েছে এবং প্রাথমিক অনুসন্ধানে তার সত্যতা পাওয়া গিয়েছে। উক্ত আচরণ প্রতিষ্ঠানের শৃঙ্খলা ও কর্মপরিবেশের জন্য ক্ষতিকর এবং একজন দায়িত্বশীল কর্মীর নিকট হতে কোনোভাবেই প্রত্যাশিত নয়।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'লঙ্ঘিত নীতিমালা',
        clauses: [
          '(ক) নির্ধারিত সময়ে কর্মস্থলে উপস্থিতি ও Attendance সংক্রান্ত নীতিমালা।',
          '(খ) দায়িত্ব পালনে যথাযথ মনোযোগ, সততা ও পেশাদারিত্ব সংক্রান্ত নীতিমালা।',
          '(গ) মেম্বার, ভিজিটর ও সহকর্মীর সাথে ভদ্র ও সম্মানজনক আচরণ সংক্রান্ত নীতিমালা।',
          '(ঘ) প্রতিষ্ঠানের সম্পদ, যন্ত্রপাতি ও তথ্যের যথাযথ ব্যবহার ও গোপনীয়তা সংক্রান্ত নীতিমালা।',
          '(ঙ) Management-এর যৌক্তিক নির্দেশনা পালন সংক্রান্ত নীতিমালা।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'সিদ্ধান্ত ও নির্দেশনা',
        clauses: [
          '(ক) এই পত্রের মাধ্যমে আপনাকে লিখিতভাবে সতর্ক করা হলো এবং এর অনুলিপি আপনার ব্যক্তিগত নথিতে সংরক্ষিত থাকবে।',
          '(খ) ভবিষ্যতে অনুরূপ আচরণ বা নীতিমালা লঙ্ঘনের পুনরাবৃত্তি সম্পূর্ণরূপে পরিহার করতে হবে।',
          '(গ) নির্ধারিত দায়িত্ব, সময়সূচি, SOP ও শৃঙ্খলা কঠোরভাবে পালন করতে হবে।',
          '(ঘ) পরবর্তী ০৩ (তিন) মাস আপনার কর্মকাণ্ড বিশেষ পর্যবেক্ষণে থাকবে।',
          '(ঙ) কোনো ব্যাখ্যা বা বক্তব্য থাকলে ০৩ (তিন) কর্মদিবসের মধ্যে Manager: Admin & HR বরাবর লিখিতভাবে দাখিল করতে পারবেন।',
        ],
      },
      {
        sectionNumber: '৫',
        titleBangla: 'পুনরাবৃত্তির পরিণতি',
        introText: 'উপরোক্ত বিষয়ে পুনরাবৃত্তি ঘটলে বা নির্দেশনা প্রতিপালনে ব্যর্থ হলে প্রতিষ্ঠানের নীতিমালা অনুযায়ী চূড়ান্ত সতর্কীকরণ, বেতন কর্তন, পদাবনতি, সাময়িক বরখাস্ত বা চাকরি হতে অবসান পর্যন্ত শাস্তিমূলক ব্যবস্থা গ্রহণ করা হবে। এ বিষয়ে কর্তৃপক্ষের সিদ্ধান্তই চূড়ান্ত বলে গণ্য হবে।',
      },
    ],
  },

  // 9. SHOW CAUSE NOTICE
  {
    letterType: 'show_cause',
    name: 'Standard Show Cause Notice',
    titleBangla: 'কারণ দর্শানো নোটিশ',
    titleEnglish: 'Show Cause Notice',
    memoPrefix: 'MGP/HR/SCN',
    subjectTemplate: 'বিষয়ঃ অভিযোগের বিষয়ে কারণ দর্শানোর নির্দেশ প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'incidentDate', labelBangla: 'ঘটনার তারিখ ও সময়', source: 'custom', required: true },
      { key: 'incidentLocation', labelBangla: 'ঘটনার স্থান', source: 'custom', required: false },
      { key: 'responseDeadline', labelBangla: 'জবাব দাখিলের শেষ তারিখ', source: 'custom', required: true },
      { key: 'incidentDescription', labelBangla: 'অভিযোগের বিবরণ', source: 'custom', required: true },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'অভিযোগের বিবরণ',
        introText: 'আপনার বিরুদ্ধে গুরুতর শৃঙ্খলাভঙ্গ ও দায়িত্বে অবহেলার অভিযোগ কর্তৃপক্ষের গোচরীভূত হয়েছে। প্রাথমিকভাবে উক্ত অভিযোগ প্রতিষ্ঠানের চাকরি বিধি ও নীতিমালার সুস্পষ্ট লঙ্ঘন হিসেবে প্রতীয়মান হয়েছে, যা গুরুতর অসদাচরণ হিসেবে গণ্য হওয়ার যোগ্য।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'প্রযোজ্য নীতিমালা / বিধি',
        clauses: [
          '(ক) দায়িত্ব পালনে অবহেলা, গাফিলতি বা ইচ্ছাকৃত ত্রুটি।',
          '(খ) অনুমোদনহীন অনুপস্থিতি বা Attendance সংক্রান্ত অনিয়ম ও কারসাজি।',
          '(গ) প্রতিষ্ঠানের সম্পদ, নগদ অর্থ বা মেম্বার তথ্যের অপব্যবহার।',
          '(ঘ) মেম্বার, সহকর্মী বা কর্তৃপক্ষের সাথে অশোভন আচরণ।',
          '(ঙ) Management-এর নির্দেশনা অমান্য করা।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'কারণ দর্শানোর নির্দেশ',
        clauses: [
          '(ক) উপরোক্ত অভিযোগের বিষয়ে আপনার আত্মপক্ষ সমর্থনে লিখিত জবাব উল্লিখিত শেষ তারিখের মধ্যে (নোটিশ প্রাপ্তির সর্বোচ্চ ০৩ কর্মদিবসের মধ্যে) দাখিল করার নির্দেশ প্রদান করা হলো।',
          '(খ) জবাব অবশ্যই Manager: Admin & HR বরাবর দাখিল করতে হবে।',
          '(গ) জবাবের সমর্থনে কোনো দলিল, প্রমাণ বা সাক্ষী থাকলে তা সংযুক্ত করতে পারবেন।',
          '(ঘ) প্রয়োজনে কর্তৃপক্ষ আপনাকে সশরীরে শুনানিতে উপস্থিত হওয়ার জন্য ডাকতে পারে।',
        ],
      },
      {
        sectionNumber: '৫',
        titleBangla: 'জবাব দাখিল না করার পরিণতি',
        introText: 'নির্ধারিত সময়ের মধ্যে সন্তোষজনক লিখিত জবাব দাখিল না করলে ধরে নেওয়া হবে যে আপনার আত্মপক্ষ সমর্থনে বলার কিছু নেই এবং সেক্ষেত্রে আপনার অনুপস্থিতিতেই প্রতিষ্ঠানের নীতিমালা অনুযায়ী একতরফাভাবে শাস্তিমূলক ব্যবস্থা গ্রহণ করা হবে।',
      },
    ],
  },

  // 10. APPRECIATION LETTER
  {
    letterType: 'appreciation',
    name: 'Standard Appreciation Letter',
    titleBangla: 'প্রশংসা ও অভিনন্দন পত্র',
    titleEnglish: 'Appreciation Letter',
    memoPrefix: 'MGP/HR/APR',
    subjectTemplate: 'বিষয়ঃ কর্মদক্ষতা ও বিশেষ অবদানের স্বীকৃতি প্রদান প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'achievementPeriod', labelBangla: 'মূল্যায়নকাল / সময়কাল', source: 'custom', required: false },
      { key: 'achievementReason', labelBangla: 'স্বীকৃতির কারণ', source: 'custom', required: true },
      { key: 'rewardOrAward', labelBangla: 'প্রদত্ত স্বীকৃতি / পুরস্কার (যদি থাকে)', source: 'custom', required: false },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'প্রশংসাপত্র',
        introText: 'অত্যন্ত আনন্দের সাথে জানানো যাচ্ছে যে, Multi Gym Premium & Multi Gym-এ আপনার নিষ্ঠা, আন্তরিকতা, পেশাদারিত্ব ও দায়িত্ববোধ কর্তৃপক্ষের দৃষ্টি আকর্ষণ করেছে। আপনার কর্মদক্ষতা ও ইতিবাচক মনোভাব প্রতিষ্ঠানের সেবার মান উন্নয়নে এবং কর্মপরিবেশ সমৃদ্ধ করতে বিশেষ ভূমিকা রেখেছে। আপনার এই অবদানের স্বীকৃতিস্বরূপ কর্তৃপক্ষের পক্ষ থেকে আপনাকে আন্তরিক অভিনন্দন ও ধন্যবাদ জ্ঞাপন করা হলো।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'বিশেষভাবে প্রশংসনীয় দিকসমূহ',
        clauses: [
          '(ক) নির্ধারিত দায়িত্ব পালনে ধারাবাহিক দক্ষতা, শৃঙ্খলা ও নির্ভরযোগ্যতা।',
          '(খ) মেম্বার/সদস্যদের সেবা, নিরাপত্তা ও সন্তুষ্টি নিশ্চিতকরণে বিশেষ যত্ন ও আন্তরিকতা।',
          '(গ) নিয়মিত উপস্থিতি, সময়ানুবর্তিতা ও প্রতিষ্ঠানের নীতিমালার প্রতি সম্মান।',
          '(ঘ) সহকর্মীদের সাথে সমন্বয়, দলগত মনোভাব ও নতুন কর্মীদের সহযোগিতা প্রদান।',
          '(ঙ) নির্ধারিত দায়িত্বের বাইরেও প্রতিষ্ঠানের প্রয়োজনে স্বতঃস্ফূর্ত অংশগ্রহণ ও উদ্যোগ।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'ভবিষ্যৎ প্রত্যাশা',
        introText: 'কর্তৃপক্ষ আশা করে যে, ভবিষ্যতেও আপনি একই নিষ্ঠা ও পেশাদারিত্ব বজায় রেখে প্রতিষ্ঠানের অগ্রযাত্রায় গুরুত্বপূর্ণ ভূমিকা পালন করবেন এবং সহকর্মীদের জন্য অনুকরণীয় দৃষ্টান্ত স্থাপন করবেন। আপনার কর্মজীবনের সার্বিক সফলতা ও উত্তরোত্তর উন্নতি কামনা করছি।',
      },
    ],
  },

  // 11. RESIGNATION ACCEPTANCE LETTER
  {
    letterType: 'resignation_acceptance',
    name: 'Standard Resignation Acceptance Letter',
    titleBangla: 'পদত্যাগপত্র গ্রহণ পত্র',
    titleEnglish: 'Resignation Acceptance Letter',
    memoPrefix: 'MGP/HR/RA',
    subjectTemplate: 'বিষয়ঃ পদত্যাগপত্র গ্রহণ প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'joiningDate', labelBangla: 'যোগদানের তারিখ', source: 'employee', employeeField: 'joiningDate', required: false },
      { key: 'resignationLetterDate', labelBangla: 'পদত্যাগপত্রের তারিখ', source: 'custom', required: true },
      { key: 'noticePeriod', labelBangla: 'নোটিশ পিরিয়ড', source: 'custom', required: false, defaultValue: 'নীতিমালা অনুযায়ী' },
      { key: 'lastWorkingDate', labelBangla: 'সর্বশেষ কর্মদিবস', source: 'custom', required: true },
      { key: 'effectiveDate', labelBangla: 'পদত্যাগ কার্যকর তারিখ', source: 'custom', required: true },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'পদত্যাগপত্র গ্রহণ',
        introText: 'দাখিলকৃত আপনার পদত্যাগপত্রটি কর্তৃপক্ষ যথাযথভাবে পর্যালোচনা করেছে। এতদ্বারা জানানো যাচ্ছে যে, আপনার পদত্যাগপত্র গ্রহণ করা হলো এবং কার্যকর তারিখ হতে প্রতিষ্ঠানের সাথে আপনার চাকরির সম্পর্কের অবসান ঘটবে। আপনার সর্বশেষ কর্মদিবস পর্যন্ত নিয়মিত দায়িত্ব পালন এবং যথাযথ হস্তান্তর সম্পন্ন করা বাধ্যতামূলক।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'দায়িত্ব হস্তান্তর ও Clearance',
        clauses: [
          '(ক) সর্বশেষ কর্মদিবসের পূর্বে সকল চলমান কাজ, নথিপত্র ও রিপোর্ট নির্ধারিত কর্মীর নিকট হস্তান্তর করতে হবে।',
          '(খ) আইডি কার্ড, ইউনিফর্ম, চাবি, ডিভাইস ও প্রতিষ্ঠানের সকল সম্পদ ফেরত দিতে হবে।',
          '(গ) Clearance Form যথাযথভাবে পূরণ করে সংশ্লিষ্ট বিভাগের স্বাক্ষর গ্রহণ করতে হবে।',
          '(ঘ) প্রতিষ্ঠানের নিকট কোনো আর্থিক দায় থাকলে তা সমন্বয় করতে হবে।',
          '(ঙ) Clearance সম্পন্ন হওয়ার পর অবমুক্তি পত্র ও অভিজ্ঞতা সনদ প্রদান করা হবে।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'চূড়ান্ত পাওনা পরিশোধ',
        clauses: [
          '(ক) চূড়ান্ত হিসাব (Final Settlement) Clearance সম্পন্ন হওয়ার পর নীতিমালা অনুযায়ী পরিশোধ করা হবে।',
          '(খ) নোটিশ পিরিয়ড অপূর্ণ থাকলে সমপরিমাণ অর্থ চূড়ান্ত হিসাব হতে সমন্বয় করা হবে।',
          '(গ) প্রতিষ্ঠানের ব্যবসায়িক গোপনীয় তথ্য চাকরি অবসানের পরেও গোপন রাখার দায়বদ্ধতা বহাল থাকবে।',
        ],
      },
      {
        sectionNumber: '৫',
        titleBangla: 'শুভেচ্ছা',
        introText: 'Multi Gym Premium & Multi Gym-এ কর্মকালীন সময়ে আপনার অবদানের জন্য কর্তৃপক্ষ আন্তরিক ধন্যবাদ জ্ঞাপন করছে এবং আপনার ভবিষ্যৎ কর্মজীবনের সার্বিক সফলতা কামনা করছে।',
      },
    ],
  },

  // 12. EXPERIENCE CERTIFICATE
  {
    letterType: 'experience_certificate',
    name: 'Standard Experience Certificate',
    titleBangla: 'অভিজ্ঞতা সনদ',
    titleEnglish: 'Experience Certificate',
    memoPrefix: 'MGP/HR/EXP',
    subjectTemplate: 'বিষয়ঃ অভিজ্ঞতা সনদ প্রদান প্রসঙ্গে।',
    hasEmployeeAcknowledgment: false,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'fatherOrHusbandName', labelBangla: 'পিতা/স্বামীর নাম', source: 'custom', required: false },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'সর্বশেষ পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'joiningDate', labelBangla: 'যোগদানের তারিখ', source: 'employee', employeeField: 'joiningDate', required: true },
      { key: 'employmentEndDate', labelBangla: 'চাকরি অবসানের তারিখ', source: 'custom', required: true },
      { key: 'totalTenure', labelBangla: 'মোট চাকরিকাল', source: 'custom', required: false },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'প্রত্যয়নপত্র',
        introText: 'এতদ্বারা প্রত্যয়ন করা যাচ্ছে যে, তিনি Multi Gym Premium & Multi Gym-এ উল্লিখিত সময়কাল পর্যন্ত সন্তোষজনকভাবে দায়িত্ব পালন করেছেন। চাকরিকালীন সময়ে তিনি নিষ্ঠা ও পেশাদারিত্বের সাথে তাঁর উপর অর্পিত দায়িত্ব সম্পাদন করেছেন এবং তাঁর কর্মদক্ষতা, উপস্থিতি, শৃঙ্খলা ও আচরণ সন্তোষজনক ছিল। তিনি নিজ ইচ্ছায় চাকরি হতে অবসান গ্রহণ করেছেন এবং প্রতিষ্ঠানের সাথে তাঁর সকল হিসাব নিষ্পত্তি হয়েছে। তাঁর বিরুদ্ধে কোনো অনিয়ম বা শৃঙ্খলাভঙ্গের অভিযোগ পাওয়া যায় নাই। তাঁর অনুরোধের ভিত্তিতে এই সনদ প্রদান করা হলো।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'পালিত দায়িত্বের বিবরণ',
        clauses: [
          '(ক) শাখার দৈনন্দিন অপারেশন ও মেম্বার সার্ভিস সংক্রান্ত দায়িত্ব।',
          '(খ) পদের সাথে সংশ্লিষ্ট প্রযুক্তিগত ও প্রশাসনিক কাজ সম্পাদন।',
          '(গ) প্রতিষ্ঠানের নির্দেশিত অন্যান্য প্রয়োজনীয় দায়িত্বসমূহ।',
        ],
      },
    ],
  },

  // 13. RELIEVING LETTER
  {
    letterType: 'relieving',
    name: 'Standard Relieving Letter',
    titleBangla: 'অবমুক্তি পত্র',
    titleEnglish: 'Relieving Letter',
    memoPrefix: 'MGP/HR/REL',
    subjectTemplate: 'বিষয়ঃ দায়িত্ব হতে অবমুক্তি প্রদান প্রসঙ্গে।',
    hasEmployeeAcknowledgment: true,
    infoFields: [
      { key: 'employeeName', labelBangla: 'কর্মচারীর নাম', source: 'employee', employeeField: 'name', required: true },
      { key: 'employeeCode', labelBangla: 'Employee ID', source: 'employee', employeeField: 'employeeId', required: true },
      { key: 'designation', labelBangla: 'সর্বশেষ পদবী', source: 'employee', employeeField: 'jobPosition', required: true },
      { key: 'department', labelBangla: 'বিভাগ', source: 'employee', employeeField: 'department', required: true },
      { key: 'branch', labelBangla: 'কর্মস্থল / শাখা', source: 'employee', employeeField: 'branches', required: true },
      { key: 'joiningDate', labelBangla: 'যোগদানের তারিখ', source: 'employee', employeeField: 'joiningDate', required: false },
      { key: 'lastWorkingDate', labelBangla: 'সর্বশেষ কর্মদিবস', source: 'custom', required: true },
      { key: 'effectiveDate', labelBangla: 'অবমুক্তি কার্যকর তারিখ', source: 'custom', required: true },
      { key: 'clearanceStatus', labelBangla: 'Clearance স্ট্যাটাস', source: 'custom', required: true, defaultValue: 'সম্পন্ন' },
    ],
    sections: [
      {
        sectionNumber: '২',
        titleBangla: 'অবমুক্তি ঘোষণা',
        introText: 'এতদ্বারা জানানো যাচ্ছে যে, আপনার পদত্যাগপত্র/চাকরি অবসান কার্যকর হওয়ার প্রেক্ষিতে উল্লিখিত তারিখ অফিস সময়ের শেষে আপনাকে Multi Gym Premium & Multi Gym-এর সকল দায়িত্ব ও কর্তব্য হতে অবমুক্ত করা হলো। উক্ত তারিখের পর হতে প্রতিষ্ঠানের সাথে আপনার চাকরিগত কোনো সম্পর্ক বিদ্যমান থাকবে না।',
      },
      {
        sectionNumber: '৩',
        titleBangla: 'Clearance ও সম্পদ ফেরত',
        clauses: [
          '(ক) দায়িত্ব হস্তান্তর, নথিপত্র ও চলমান কাজ কর্তৃপক্ষের মনোনীত প্রতিনিধির নিকট হস্তান্তর সম্পন্ন হয়েছে।',
          '(খ) আইডি কার্ড, ইউনিফর্ম, চাবি, ডিভাইস ও অন্যান্য সম্পদ যথাযথভাবে ফেরত প্রদান করা হয়েছে।',
          '(গ) সংশ্লিষ্ট বিভাগসমূহ হতে Clearance গ্রহণ সম্পন্ন হয়েছে।',
          '(ঘ) Attendance Device ও অভ্যন্তরীণ সিস্টেম হতে অ্যাক্সেস প্রত্যাহার করা হয়েছে।',
        ],
      },
      {
        sectionNumber: '৪',
        titleBangla: 'চূড়ান্ত হিসাব ও পরবর্তী দায়বদ্ধতা',
        clauses: [
          '(ক) চূড়ান্ত হিসাব (Final Settlement) প্রতিষ্ঠানের নীতিমালা অনুযায়ী নিষ্পত্তি করা হয়েছে বা নির্ধারিত সময়ে নিষ্পন্ন করা হবে।',
          '(খ) চাকরিকালীন সময়ে অর্জিত বাণিজ্যিক গোপনীয় তথ্য চাকরি অবসানের পরেও গোপন রাখার দায়বদ্ধতা বহাল থাকবে।',
          '(গ) প্রতিষ্ঠানের ব্র্যান্ড, লোগো বা সদস্য তথ্য ব্যক্তিগত বা বাণিজ্যিক কোনো উদ্দেশ্যে ব্যবহার করা যাবে না।',
        ],
      },
      {
        sectionNumber: '৫',
        titleBangla: 'শুভেচ্ছা',
        introText: 'Multi Gym Premium & Multi Gym-এ কর্মকালীন সময়ে আপনার সেবার জন্য আন্তরিক ধন্যবাদ জ্ঞাপন করছি এবং আপনার ভবিষ্যৎ জীবনের সমৃদ্ধি কামনা করছি।',
      },
    ],
  },
];
