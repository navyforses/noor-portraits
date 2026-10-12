# NOOR Portraits — working demo MVP

სამენოვანი პორტრეტების სტუდია: `/ar` (ნაგულისხმევი), `/en`, `/ka`; ადმინისტრატორი: `/ka/admin` ან `/admin`.

**დემო საიტია. რეალური გაყიდვები გამორთულია.** გადახდის, AI-ისა და ელფოსტის ჩართვა აღწერილია ფაილში `docs/LAUNCH_INTEGRATIONS.md`. სამუშაო ბრენდის, დომენისა და სავაჭრო ნიშნის ხელმისაწვდომობა არ დადასტურებულა.

## რა მუშაობს

- არაბული RTL, ქართული/ინგლისური LTR; ქართული და არაბული ფონტები ლოკალურადაა ჩაშენებული.
- სამი სტილი, სამი რედაქტირებადი პაკეტი, ფილტრები, ხუთსაფეხურიანი შეკვეთა და ენის შეცვლისას დროებითი მონახაზის შენარჩუნება.
- მუდმივი D1 ბაზა და კერძო R2 ფაილები. ფაილის რეალური ფორმატის შემოწმება, სრული დეკოდირება და JPEG-ად ხელახალი კოდირება EXIF-ის გარეშე.
- მობილურზე ფოტოები მაქსიმუმ 1800 პიქსელამდე მცირდება გაგზავნამდე; სერვერი კვლავ ამოწმებს ყველაფერს. JPEG/PNG/WebP, 8 MB, სერვერზე მაქსიმუმ 4.2 MP. HEIC არ არის ჩართული.
- სერვერული ფასები, თითო შეკვეთაზე პაკეტის/ფასის ასლი, განცალკევებული თანხმობები, გადახდის/შეკვეთის/გენერაციის სტატუსები.
- სრული mock გადახდა: წარმატება, მარცხი, გაუქმება, განმეორებითი დადასტურება, დემო დაბრუნება. ბარათის მონაცემები არ გროვდება.
- ადმინისტრატორის რეალური პაროლით ავტორიზაცია: PBKDF2, შემთხვევითი salt, HttpOnly სესია, ვადა, როლით დაშვების შემოწმება, მოთხოვნების ლიმიტი და same-origin დაცვა.
- რეალური ფინალური ფაილების ადმინისტრატორის მიერ ატვირთვა, საჭირო რაოდენობისა და ხარისხის დამტკიცება, კერძო გალერეა, ინდივიდუალური და ZIP ჩამოტვირთვა.
- ერთჯერადი 24-საათიანი პირადი წვდომის ბმული, 10-წუთიანი ხელმოწერილი ფაილის URL-ები, ვადაგასული ბმულების ბლოკირება.
- შესწორების ერთი მოთხოვნა (რედაქტირებადია), დაბრუნების მოთხოვნა/დემო დამტკიცება, ფოტოების წაშლის მოთხოვნა.
- ქართულად ნაგულისხმევი პანელი: შეკვეთები/ფილტრები, ფინანსები, პაკეტები/სტილების ჩართვა, სამენოვანი კონტენტი, მონახაზი/შემოწმებული გამოქვეყნება, პარამეტრები და აქტივობის ჟურნალი.
- ტექნიკური ანალიტიკის მოვლენები შეიცავს მხოლოდ მოვლენის სახელსა და დროს. ფოტო, ელფოსტა და მომხმარებლის ტექსტი არ გადაეცემა ანალიტიკას.

## რომელი ინტეგრაცია არ არის ჩართული

| ნაწილი | მდგომარეობა |
|---|---|
| გადახდა | ნაგულისხმევად MockPaymentProvider. Bank of Georgia ჩართულია კოდში (`lib/server/bog.ts`) და მუშაობს პანელში არჩევისა და Cloudflare საიდუმლოებების შემდეგ. TBC კვლავ უსაფრთხოდ ჩერდება. |
| ბანკის ადაპტერები | BOG: შეკვეთა, callback (სტატუსი ყოველთვის ბანკის API-დან მოწმდება), დაბრუნება. ოფიციალური დოკუმენტაციით, შემოწმებულია იმიტირებული API-ით. TBC: `UnconfiguredBankProvider`. |
| AI | ნაგულისხმევად ხელით შესრულება. პანელში აირჩევა Google Gemini (`gemini-nano-banana-2.1`, `GEMINI_API_KEY`) ან OpenAI (`gpt-image-2.5-sunburst`, `OPENAI_API_KEY`); მიწოდება ავტომატურია. |
| სამუშაოების სისტემა | D1-ში ინახება, ფონური დამუშავება და მოთხოვნების ლიმიტი არსებობს; დაუკავშირებელი AI გადადის ხელით შესრულებაზე. Live გენერაციის ტრანსპორტი, provider polling და timeout reconciliation ჯერ დასასრულებელია. |
| ელფოსტა | Resend: `RESEND_API_KEY` და პანელში გამგზავნის მითითების შემდეგ. მათ გარეშე არაფერი იგზავნება. |
| ახალი ბმულის თვითმომსახურება | ელფოსტა + შეკვეთის ნომრით, მხოლოდ გადახდილ შეკვეთაზე; პასუხი ყოველთვის ერთნაირია. |
| მარკეტინგული ანალიტიკა | გამორთულია. ვიზიტორიდან მყიდველამდე კონვერსია არ ითვლება სანდო ვიზიტორთა დენომინატორის გარეშე. |
| AI / ხელით შესრულების ხარჯი | მიუწვდომელია; მოგებად არ არის წარმოდგენილი. |
| ვალუტა | მხოლოდ ზუსტი დემო EUR. SAR/AED შეფასებები და დაუდასტურებელი კურსები არ გამოიყენება. |

## უსაფრთხო ადმინისტრატორის წვდომა

1. პირველი დაყენებისთვის გახსენით გადმოცემული პირადი setup-ბმული. მისი ფრაგმენტი შეიცავს ერთჯერად დაყენების გასაღებს; გვერდი მას დაუყოვნებლივ შლის მისამართიდან.
2. შექმენით მინიმუმ 14-სიმბოლოიანი უნიკალური პაროლი. პაროლი არც რეპოზიტორიაშია და არც წინასწარ გაწერილი.
3. შემდგომ შედით `/ka/admin`-ზე თქვენი პაროლით. სესია 8 საათია.
4. დაყენების შემდეგ `ADMIN_SETUP_KEY` წაშალეთ განთავსების საიდუმლო პარამეტრებიდან შემდეგი განახლებისას. არსებული ანგარიშის პირობებში ხელახალი რეგისტრაცია ისედაც დაბლოკილია.
5. setup-ბმული არ გააზიაროთ. დემო განთავსება მფლობელისთვის კერძოა; მომხმარებლების საჯარო წვდომა არ არის გააქტიურებული.

## ლოკალური გაშვება

Stack: TypeScript + React + Next-compatible Vinext, Cloudflare Workers, D1 (SQLite), R2. PostgreSQL არ გამოიყენება: ეს stack შეესაბამება ხელმისაწვდომ მუდმივ საცავს და ჰოსტინგს.

```bash
npm run install:ci
# შექმენით .dev.vars თქვენი შემთხვევითი ADMIN_SETUP_KEY, FILE_SIGNING_KEY, MAINTENANCE_KEY მნიშვნელობებით.
# Runtime binding-ები: DB და BUCKET. .env.example მხოლოდ ცვლადების სახელებს/ცარიელ მნიშვნელობებს შეიცავს.
npm run db:generate
npm run build
# მიგრაციების ლოკალურად გამოყენება:
node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --file drizzle/0000_clean_nocturne.sql
npm run dev
```

Sites გარემოში გამოიყენება პროექტის ინსტრუქციებით გათვალისწინებული ინსტალაცია/preview/publish. ჰოსტინგის ID და ლოგიკური საცავები წერია `.openai/hosting.json`-ში. საიდუმლოებები მხოლოდ runtime პარამეტრებშია.

## ტესტები

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run build
node tests/integration.mjs
```

ტესტები უშვებს ნამდვილ build-ს იზოლირებულ Workers runtime-ში ახალი D1/R2 საცავებით; მომხმარებლის მონაცემებს არ ეხება. fixtures მხოლოდ სინთეზური მოზრდილებია. შედეგები: `docs/QA.md`.

## ავტომატური შენახვის ვადები

`wrangler.jsonc` შეიცავს საათობრივ (`17 * * * *`, წმენდა) და ყოველწუთიან (`* * * * *`, AI გენერაცია) cron-ს; Worker-ის `scheduled` handler იძახებს `cleanup()`-ს. ეს ნამდვილი scheduled-handler ტესტითაა გადამოწმებული ლოკალურ runtime-ში. ჰოსტინგზე cron-ის გააქტიურება/რეალური შესრულება ცალკე უნდა დადასტურდეს გაშვებამდე; ეს ავტომატურად წარმატებულად არ ითვლება მხოლოდ საიტის განთავსებით.

- გადაუხდელი ფოტოები: 24 საათი.
- საწყისი ფოტოები: მიწოდებიდან 1 დღე (ნაგულისხმევი).
- შედეგები: მიწოდებიდან 1 დღე (ნაგულისხმევი).
- გადახდილი, მაგრამ მიუწოდებელი შეკვეთის ფოტოები: მაქსიმუმ 14 დღე.
- ფაილზე წვდომა ვადის გასვლისთანავე იბლოკება, წმენდის მომდევნო გაშვებამდე.
- ხელით გაშვება: პანელში „ვადაგასული ფაილების წაშლა“.
- გარე scheduler-ის ალტერნატივა: `POST /api/maintenance`, `Authorization: Bearer MAINTENANCE_KEY`. საიდუმლო URL-ში არ ჩასვათ.
- აქტიური R2 ასლები იშლება; ინფრასტრუქტურის სარეზერვო ასლების სრული წაშლა არ არის გარანტირებული. დასრულებული შეკვეთებისა და ფინანსური ჩანაწერების შენახვის სამართლებრივი ვადა ცალკე დასადგენია.

## წარმოებაში გაშვების აუცილებელი ბლოკერები

- კომპანიის სრული სახელი, რეგისტრაცია/საგადასახადო ნომერი, მისამართი, მოქმედი მხარდაჭერის ელფოსტა.
- TBC ან Bank of Georgia-ს არჩევა, მერჩანტის დამტკიცება, live credentials, merchant account-ზე საერთაშორისო ბარათებისა და Apple Pay-ის დადასტურება.
- ბანკის სრული ადაპტერის დასრულება მიმდინარე ოფიციალური დოკუმენტაციით; სერვერული verification/callback/refund, ვალუტისა და თანხის შესაბამისობისა და იდემპოტენტურობის live sandbox ტესტები.
- AI პროვაიდერის არჩევა: სახის მსგავსების ხარისხი, კომერციული უფლებები, მონაცემთა შენახვა, ხარჯი, ხელმისაწვდომობა; API credentials, privacy/DPA განხილვა; სრულად სამუშაო გენერაცია/polling/timeout reconciliation ან დადასტურებული ხელით შესრულების ოპერაცია.
- ელფოსტის პროვაიდერი, დამოწმებული გამგზავნი, SPF/DKIM/DMARC, ნამდვილი მიწოდებისა და ახალი ბმულის აღდგენის ტესტები.
- საკუთარი დომენი, DNS, საჭირო callback/return URL-ების რეგისტრაცია. ბრენდისა და სავაჭრო ნიშნის შემოწმება.
- ყველა არაბული ტექსტის მშობლიურ ენაზე მოსაუბრის მიერ შემოწმება. საწყისი არაბული კონტენტი პანელში შეუმოწმებლადაა მონიშნული.
- საბოლოო იურიდიული პოლიტიკები საქართველოს გამყიდველისთვის და მიზნობრივი ბაზრებისთვის; მომხმარებლის უფლებები, მონაცემთა დაცვა, ვადები და დაბრუნების პირობები.
- რეალურ ჰოსტინგზე ავტომატური წმენდის განრიგისა და წაშლის შემოწმება.
- რეალურ მობილურ ბრაუზერებში ატვირთვის, კლავიატურის, 200%-იანი ტექსტის, RTL-ის, ნელი ქსელისა და აღდგენის საბოლოო ვიზუალური QA.
- ხარჯების რეალური აღრიცხვა და თანხმობაზე მორგებული კონვერსიის დათვლა, თუ საჭიროა.

ოფიციალური საბანკო დოკუმენტაცია (შემოწმებულია 2026-10-09):
- https://developers.tbcbank.ge/docs/checkout-overview
- https://api.bog.ge/docs/en/payments/introduction

საჯარო paid-sales რეჟიმი არ არსებობს: მხოლოდ secret-ის დამატება არ ჩართავს რეალურ ჩამოჭრას. საჭიროა ზემოთ ჩამოთვლილი სამუშაოსა და ტესტების დასრულება.

## Conversion-focused update

- First Portrait: 3 portraits / 1 style, provisional €7 demo price. Original packages retained. Admin can edit or deactivate it. No SAR/AED conversion is implied.
- Focused cinematic/profile entry offers; preselected package/style links skip repeated selection. Three stages: look/package, photos, review/payment. Legacy local drafts migrate to the new stages.
- Optional preferences are collapsed; poster name/title appear for cinematic orders. WhatsApp is preserved in existing drafts but not requested on the first-purchase screen.
- Age, photo rights and AI consent are enforced server-side before uploading. Original files up to 20 MB are resized in the browser; server remains limited to sanitized 8 MB / 4.2 MP. HEIC remains unsupported.
- Per-photo real byte progress, separate failures/retries, and idempotent upload IDs. No synthetic generation progress.
- Optional first-party measurement: explicit consent, one-day HttpOnly session cookie, 30-day pseudonymous record retention and withdrawal. No advertising pixels or private customer text. Sessions are not unique people; opt-out traffic is excluded.
- Georgian-default Offers & funnel dashboard separates demo activity from real paid sales. Funnel is descriptive, not an active randomized price experiment. Commercial outcomes come only from the server.
- Admin order cost ledger accepts actual generation, review, support, payment and other variable costs, grouped by transaction currency. Recorded costs may be incomplete; no profit claim.
- New schema delta: drizzle/0001_last_mattie_franklin.sql. Existing orders/data are preserved.

Still blocked: live payment approval/credentials and provider adapter, international cards/Apple Pay confirmation, reliable generation or operational manual fulfillment, email/domain, business details, native Arabic and legal review, actual hosted retention schedule verification. Authorized before/after evidence requires a real quality pilot and separate publication consent.
