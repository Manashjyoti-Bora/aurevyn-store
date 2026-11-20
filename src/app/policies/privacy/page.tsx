import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import { SupportContact } from '@/components/store/support-contact';
import { env } from '@/lib/env';
import { PolicyView } from '@/components/policies/policy-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: 'Privacy Policy',
    description: `How ${settings.storeName} collects, uses and protects your personal data.`,
    alternates: { canonical: '/policies/privacy' },
    openGraph: {
      title: `Privacy Policy | ${settings.storeName}`,
      url: `${env.APP_URL}/policies/privacy`,
    },
  };
}

const LAST_UPDATED = '2026-11-18';

export default async function PrivacyPolicyPage() {
  const settings = await getSettings();

  return (
    <PolicyView
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      settings={settings}
      sections={[
        {
          heading: 'Who is responsible for your data',
          body: (
            <>
              <p>
                {settings.business.legalName || settings.storeName} is the{' '}
                <strong>Data Fiduciary</strong> for the personal data described below, and decides
                why and how it is processed, in line with India&apos;s Digital Personal Data
                Protection Act, 2023 (DPDP Act).
              </p>
              <p className="mt-2">
                Postal address:{' '}
                {settings.business.addressLine
                  ? [
                      settings.business.addressLine,
                      settings.business.city,
                      settings.business.state,
                      settings.business.postalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')
                  : 'shown on the contact page and invoice of every order'}
                . Grievance and privacy contact:{' '}
                <SupportContact settings={settings} fallback="via the contact form" />.
              </p>
            </>
          ),
        },
        {
          heading: 'What we collect',
          body: (
            <>
              <p>We collect only what is needed to run your orders:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Account data:</strong> name, email, mobile number and a password stored
                  only as a cryptographic hash (never in plain text).
                </li>
                <li>
                  <strong>Order data:</strong> shipping address, order contents, amounts, and
                  order/tracking history.
                </li>
                <li>
                  <strong>Payment references:</strong> the UPI transaction reference (UTR) you
                  submit and the payment status.{' '}
                  <strong>
                    We never see or store card numbers, CVVs, UPI PINs or netbanking credentials
                  </strong>{' '}
                  — you pay inside your own UPI app, so no payment credential ever reaches this
                  store.
                </li>
                <li>
                  <strong>Technical data:</strong> IP address and request metadata for security
                  (rate limiting, fraud and abuse prevention) and error diagnosis.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: 'Why we process it (legal bases)',
          body: (
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Contract performance:</strong> processing payment, fulfilling and delivering
                your order, handling returns/refunds.
              </li>
              <li>
                <strong>Legal obligations:</strong> tax/accounting records (e.g. GST invoices),
                responses to lawful requests.
              </li>
              <li>
                <strong>Legitimate interests:</strong> security, fraud prevention, service
                reliability.
              </li>
              <li>
                <strong>Consent:</strong> marketing emails only if and when you opt in; you can
                withdraw at any time.
              </li>
            </ul>
          ),
        },
        {
          heading: 'Consent, and how to withdraw it',
          body: (
            <>
              <p>
                We rely on consent only where the law requires it — for example marketing email.
                Nothing else here is optional: an order cannot be delivered without an address,
                and a UPI payment cannot be matched to your order without the transaction
                reference you submit.
              </p>
              <p className="mt-2">
                You can withdraw consent at any time by replying to a marketing email, updating
                your contact preferences, or contacting us. Withdrawing consent stops future
                processing; it does not make lawful processing that already happened unlawful, and
                it does not remove records we must keep by law.
              </p>
            </>
          ),
        },
        {
          heading: 'Cookies we set',
          body: (
            <>
              <p>
                We use only <strong>essential cookies</strong>. There are no advertising,
                profiling or third-party tracking cookies in this store.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Login session</strong> — httpOnly, SameSite=Lax, Secure in production;
                  keeps you signed in and expires when you log out or after the session lifetime.
                </li>
                <li>
                  <strong>Cart</strong> — remembers an anonymous cart before you sign in, so you do
                  not lose it at checkout.
                </li>
                <li>
                  <strong>CSRF token</strong> — a per-session security token that stops other sites
                  from submitting actions as you.
                </li>
                <li>
                  <strong>Cookie notice acknowledgement</strong> — stored in your browser only, so
                  the notice is not shown repeatedly.
                </li>
              </ul>
              <p className="mt-2">
                Payment pages load the payment gateway&apos;s own scripts, which may set cookies
                while you are on their secure interface; those are governed by the gateway&apos;s
                privacy policy. Blocking essential cookies in your browser will stop sign-in,
                cart and checkout from working.
              </p>
            </>
          ),
        },
        {
          heading: 'Who we share data with',
          body: (
            <>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Payment partners</strong> — your UPI app and bank process the payment
                  and refunds.
                </li>
                <li>
                  <strong>Suppliers &amp; logistics partners</strong> — the minimum needed to fulfil
                  and deliver your order (name, address, phone, items).
                </li>
                <li>
                  <strong>Email/SMS infrastructure providers</strong> — to send transactional
                  notifications.
                </li>
                <li>
                  <strong>Hosting/infrastructure providers</strong> — where this application and
                  database run.
                </li>
              </ul>
              <p>We do not sell your personal data, ever.</p>
            </>
          ),
        },
        {
          heading: 'Where your data is processed',
          body: (
            <p>
              Our database and application servers, and some of the providers listed above, may
              process data on servers located outside India. Where that happens we rely on the
              permitted transfer routes under the DPDP Act, require the recipient to protect the
              data to at least this standard, and never transfer more than the purpose needs.
            </p>
          ),
        },
        {
          heading: 'Retention',
          body: (
            <p>
              Order and transaction records are retained as required by Indian tax and commercial
              law (commonly 8 years for financial records). Account data is retained while your
              account is active; login sessions expire automatically. You may request deletion of
              your account, subject to retention obligations for past orders.
            </p>
          ),
        },
        {
          heading: 'Security',
          body: (
            <p>
              Passwords are hashed with bcrypt. Sessions use httpOnly, SameSite cookies. All
              sensitive operations are protected against CSRF, rate limiting is applied to
              authentication and checkout endpoints, and payment confirmations require server-side
              gateway verification. Despite these measures, no system is 100% secure; report any
              concern to us immediately.
            </p>
          ),
        },
        {
          heading: 'If there is a data breach',
          body: (
            <p>
              If a breach affects your personal data we notify the Data Protection Board of India
              and every affected person without undue delay, describing what happened, what data
              was involved and what we have done about it. We keep an internal record of every
              security incident, including ones that turn out not to be breaches.
            </p>
          ),
        },
        {
          heading: 'Your rights',
          body: (
            <>
              <p>
                Under the DPDP Act you can: ask for a summary of the personal data we hold about you
                and who we shared it with; ask us to correct or complete it; ask us to erase it;{' '}
                withdraw consent; and nominate another person to exercise these rights if you die or
                become incapacitated.
              </p>
              <p className="mt-2">
                You can erase your account yourself at any time: go to{' '}
                <strong> My account → Profile &amp; security → Delete my account</strong>. It removes
                your login, profile, addresses, cart and wishlist immediately; order, payment and
                tax records are retained as law requires. For anything else, contact{' '}
                <SupportContact settings={settings} fallback="us via the contact form" /> and we will
                respond within 30 days (usually much sooner).
              </p>
              <p className="mt-2">
                If you are not satisfied with our response you may complain to the Data Protection
                Board of India.
              </p>
            </>
          ),
        },
        {
          heading: 'Children',
          body: (
            <p>
              This store is not directed at children under 18; we do not knowingly collect their
              data.
            </p>
          ),
        },
        {
          heading: 'Changes to this policy',
          body: (
            <p>
              Material changes will be reflected in the &ldquo;Last updated&rdquo; date above and,
              where appropriate, announced by email or a site banner.
            </p>
          ),
        },
        {
          heading: 'Grievance officer',
          body: (
            <p>
              As required for Indian e-commerce entities, grievance contact:{' '}
              <SupportContact settings={settings} fallback="via the contact form" />
              {settings.business.legalName
                ? `, ${settings.business.legalName}`
                : ' (to be appointed by the store owner before launch)'}
              .
            </p>
          ),
        },
      ]}
    />
  );
}
