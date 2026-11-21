# জেনভৰা (Zenvora) — মালিকৰ বাবে সম্পূৰ্ণ গাইড (Assamese Owner Guide)

> এইটো আপোনাৰ store ৰ বাবে এখন সৰল, সম্পূৰ্ণ নিৰ্দেশিকা। ইংৰাজী দস্তাবেজবোৰ
> (`README.md`, `docs/OWNER_RUNBOOK.md`, `docs/DEPLOYMENT.md`) থকাৰ পিছতো আপোনাৰ
> অসমীয়াত লিখা গাইডখন ইয়াত দিলোঁ। প্ৰতিটো কাম কেনেকৈ কৰিব লাগে সেইয়া একে একে কৈ ধৰো।

---

## ১. জেনভৰা কি? (What is Zenvora?)

জেনভৰা হৈছে এটা **প্ৰকৃত (real) e-commerce / reselling store** — ডেমো নহয়। ই এটা
কম্পিউটাৰ বা মোবাইলৰ পৰা খোলা যাব পৰা ৱেবছাইট য'ত ক্ৰেতা সামগ্ৰী কিনিব পাৰে,
আৰু আপুনি Meesho ৰ পৰা সেই সামগ্ৰী resell কৰি লাভ (margin) কামাব পাৰে।

ই কেবল এখন ৱেবছাইট নহয় — ইয়াত আছে:
- **Storefront** (ক্ৰেতা দেখা পায়): home, shop, product, cart, checkout, UPI পেমেণ্ট, order tracking।
- **Admin console** (`/admin`): আপোনাৰ নিয়ন্ত্ৰণ কক্ষ — product, orders, suppliers, analytics, settings।
- **Automation** (কাম আপোনাৰ হাত নোহোৱাকৈ চলে): cron jobs, autonomous team, AI CEO, কণ্যাসাৰ্জ (concierge)।

> **সতৰ্কতা (honesty):** এইটোৱে আপোনাক সকলো কাম "২৪×৭ নিজেই" কৰি দিয়ে — কিন্তু
> ব্যৱসায়ৰ কিছু সিদ্ধান্ত (যেনে Meesho ত অৰ্ডাৰ দিয়া, UPI ত পৈছা নিশ্চিত কৰা) মানুহ
> হিচাপে আপোনাকে কৰিব লাগে। এটা "নিজে চলা AI বন্ধু"ৰ দৰে কল্পনা কৰাটো নিৰাপদ নহয় —
> বাস্তৱত ই এটা শক্তিশালী সহায়ক ব্যৱস্থা (tool)। তথাপিও ই বহুত কাম আপোনাৰ হাতৰ পৰা
> লৈ লয়।

---

## ২. Store ৰ নাম (Brand name)

- বৰ্তমান নাম: **Zenvora** (আপোনাৰ repository ৰ নাম `zenvora-store` ৰ পৰাই লোৱা)।
- নাম সলনি কৰিব বিচাৰে? → **Admin → Settings → Store name** ত সলনি কৰক।
  সিস্টেমে database ত সেই নাম ব্যৱহাৰ কৰিব।
- কোডৰ ভিতৰত (`resellix_*`, `RX-` order number) পুৰণি নাম ৰাখি দিয়া হৈছে — সেইটো
  কেৱল কম্পিউটাৰৰ বাবে, ক্ৰেতা কোনো দেখা নাপায়।

---

## ৩. Live কেনেকৈ কৰিব (Production deploy)

স্থানীয় (local) চলোৱাৰ বাবে `README.md` ৰ "Getting started" চাওক।
জীৱন্ত (live) কৰিবলৈ আটাইতকৈ সহজ পথ: **Vercel + Neon Postgres**।

১. **Neon Postgres** বনাওক (বিনামূলীয়া প্ৰাৰম্ভ) → এটা project আৰু database বনাওক।
   সংযোগ URL পাব: `postgresql://user:pass@host/db?sslmode=require`।
২. **Vercel** ত project যোগ কৰক আৰু সেই GitHub repo (`Manashjyoti-Bora/zenvora-store`)
   connect কৰক। Build command: `npm run build`, install: `npm ci`।
৩. Vercel → Settings → Environment Variables ত তলৰ সমূহ দিয়ক:
   - `DATABASE_URL` = Neon ৰ **pooled** URL
   - `DIRECT_URL` = Neon ৰ **direct** (non-pooler) URL
   - `APP_NAME=Zenvora`
   - `ADMIN_EMAIL` আৰু `ADMIN_PASSWORD` (প্ৰথম admin account)
   - `UPI_VPA` = আপোনাৰ UPI ID (যেনে `yourname@bank`)
   - `UPI_PAYEE_NAME` = আপোনাৰ নাম
   - `PAYMENTS_TEST_MODE=false`, `SUPPLIER_DEMO_MODE=false`
   - `CRON_SECRET` = যিকোনো দীঘল ৰেণ্ডম শব্দ
   - `NEXT_PUBLIC_APP_URL` = আপোনাৰ deployed URL
   - `EMAIL_FROM`, `SUPPORT_EMAIL` (SMTP নাথাকিলে console ত দেখুৱাব)
৪. **Deploy** কৰক। Build ৰ সময়ত `prisma migrate deploy` আপোনাৰ database বনাই দিয়ে।
৫. Deploy হ'বৰ পিছত catalogue install কৰক: Admin → Products → "Install catalogue"
   (অথবা `npm run catalogue:install` server ত)।

> Database নাথাকিলে build বন্ধ হ'ব। প্ৰথমে Neon connect কৰাটোৱেই মূল কাম।

---

## ৪. মূল কাম — Meesho ৰ পৰা reselling (The core loop)

এইটোৱেই আপোনাৰ দৈনিক কাম। Meesho ৰ কোনো public API নাই, সেয়ে অৰ্ডাৰ দিয়াটো
আপোনাকে কৰিব লাগে (এইটোৱেই "manual fulfilment")। কিন্তু বাকীবোৰ স্বয়ংক্ৰিয়:

১. **ক্ৰেতাই অৰ্ডাৰ কৰে** → UPI ত পৈছা দিয়ে (অথবা COD)।
২. **আপোনাক সতৰ্ক কৰা হয়** → Admin ত থাকোঁতে আপোনাৰ ব্ৰাউজাৰে কথা কয়:
   *"New Zenvora order RX-..., from <নাম>। Amount ₹... । Your estimated profit ₹... ।
   Please place it on Meesho."* (এই voice alert ট'গল admin ত ডাইন বাওঁফালে থাকে)।
   লগতে এটা toast (সৰু বাৰ্তা) দেখুৱায়।
৩. **Meesho ত লগিন কৰক** → product ৰ নাম সন্ধান কৰক (Admin → Orders → supplier order ত
   "Meesho search" লিংক আছে)।
৪. **ক্ৰেতাৰ ঠিকনা ত অৰ্ডাৰ দিয়ক** (আপোনাৰ মাৰ্জিন বাদ দি মূল মূল্য ত)।
৫. **Tracking record কৰক** → Admin → Supplier orders ত courier আৰু tracking number
   পেলাওক। Order "Shipped" হ'ব, ক্ৰেতাক email/message যাব।
৬. **পৈছা নিশ্চিত** → UPI ত UTR মিলাওক (Admin → Payments)। COD হ'লে "cash collected"।
৭. **Delivered** হ'লে profit finalised হয় — Analytics ত দেখুৱায়।

মাৰ্জিন (আপোনাৰ লাভ) কেনেকৈ কাম কৰে: ক্ৰেতাই দিয়া দাম − Meesho ৰ মূল্য − shipping − fee
= আপোনাৰ estimated profit। ইয়াক pricing engine আপোনাৰ হতুৱাই গণনা কৰে (দেখুৱায়
Admin → Analytics / Order details)।

---

## ৫. GSTIN / GSIN (আপোনাৰ কথা: "মোৰ GSTIN নাই")

- **GSTIN নাই** — চিন্তা নকৰিব। প্ৰাৰম্ভত আপুনি ব্যক্তিগত ব্যৱসায়ী হিচাপে আৰম্ভ কৰিব
  পাৰে। নিয়ম অনুসৰি turnover নিৰ্দ্দিষ্ট সীমা (সাধাৰণতে ₹২০/৪০ লাখ) পাৰ হ'লে GST
  নিবন্ধন বাধ্যতামূলক। তাৰ আগলৈকে মূল্য "inclusive" ৰাখিব পাৰে।
- **পৰামৰ্শ**: নিজা CA / আইনী সহায় লওক। Admin → Settings ত পিছত GSTIN দিব পাৰে।
- **GSIN** (সাধাৰণতে product GTIN/barcode) — আপোনাৰ নাথাকিলে system য়ে সেইটো
  নোৱাৰা বুলি handle কৰে; product ত GTIN এখন optional ক্ষেত্ৰ। বাধ্যতামূলক নহয়।

---

## ৬. Voice alert (কণ্ঠস্বৰ সতৰ্কতা) কেনেকৈ চালু কৰিব

- Admin console (মোবাইল বা কম্পিউটাৰ) ত থাকোঁতে ডাইন বাওঁফালে তলত এটা
  স্পীকাৰ বুটাম থাকে।
- সেইটো টিপক → voice ON/OFF হয় (local ৰৱাত ৰখা হয়)।
- ON থাকিলে নতুন অৰ্ডাৰ আহিলে ব্ৰাউজাৰে ইংৰাজীত (en-IN) কথা কয়। ব্ৰাউজাৰত
  "speech" সহায়ক নাথাকিলে বুটামটো দেখা নাযায় (সেইটো স্বাভাৱিক)।

---

## ৭. Automation — "hands-free" কাম (২৪×৭)

- **Cron jobs**: supplier fulfilment, status sync, cancellations, email — এটা
  job queue ৰে চলে। Vercel ত `vercel.json` / cron ৰ জৰিয়তে `/api/cron/jobs`
  চলোৱাব লাগে (৫-১০ মিনিটৰ মূৰা)।
- **Autonomous team / AI CEO**: Admin → Team / AI CEO ত দেখা পাব। এইবোৰ
  পৰামৰ্শ আৰু ৰিপোৰ্ট দিয়ে; সিদ্ধান্ত ল'বলৈ আপোনাৰ অনুমোদন লয়।
- **Concierge**: ক্ৰেতাই ৱেবছাইটত কথা পাতিব পাৰে (নীচে সোঁফালে)।

> AI ৰ বাবে API key দিব লাগে (যেনে OpenAI/Google) — সেইটো আপোনাৰ নিজা খাতাত।
> "GitHub ৰ পৰা বিনামূলীয়া API key" বুলি কোনোৱে নাথাকে; সেয়ে সোঁধানি।

---

## ৮. Launch আগত (cleanup) — ডেমো data আঁতৰাওক

প্ৰথমবাৰ live কৰাৰ আগত ডেমো data কাঢ়িব লাগে:
```
npm run cleanup:demo -- --execute
```
(প্ৰথমে dry-run চাব বিচাৰে তেতিয়া `-- --execute` নিদিয়াকৈ চলাওক।)

---

## ৯. সুৰক্ষা আৰু সততা (Safety & honesty)

- **Fake কিছু নাই**: review কেৱল delivered order ৰ পৰা আহে; stock প্ৰকৃত; মুনাফা
  "estimated" বুলি দেখুৱায় যেতিয়ালৈ finalised নহয়।
- **UPI**: ব্ৰাউজাৰে নিজেই অৰ্ডাৰ "paid" চিহ্নিত কৰিব নোৱাৰে — আপুনি UTR মিলাই
  confirm কৰিব লাগে।
- **কাৰ্ডৰ তথ্য** এই server লৈ কেতিয়াও নাহে।

---

## ১০. Go-live checklist (এটা চক্ৰী)

- [ ] Neon Postgres বন্ধা আৰু `DATABASE_URL`/`DIRECT_URL` দিয়া।
- [ ] `UPI_VPA` দিয়া (নাইবা COD চালু)।
- [ ] `ADMIN_EMAIL`/`ADMIN_PASSWORD` দিয়া; পিছত password সলনি কৰক।
- [ ] `catalogue:install` চলোৱা (product প্ৰকাশ হ'ল)।
- [ ] `cleanup:demo -- --execute` চলোৱা।
- [ ] Voice alert toggle ON কৰক (admin ত)।
- [ ] Cron `/api/cron/jobs` আৰু `/api/cron/team` Vercel ত চেডিউল কৰক (`CRON_SECRET` লগত)।
- [ ] GSTIN পিছত Settings ত দিয়া (বিশেষজ্ঞৰ সৈত চৰ্চা কৰি)।
- [ ] এটা test order কৰক (COD বা TEST mode) → Meesho ত place কৰক → tracking দিয়ক।

---

যিকোনো সমস্যা হ'লে `docs/TROUBLESHOOTING.md` চাওক। ভালদৰে চলাবলৈ এই গাইডখন
এবাৰ পঢ়ি ৰাখিব। শুভেচ্ছা — জেনভৰাৰ লগত ব্যৱসায় আৰম্ভ কৰক! 🌿
