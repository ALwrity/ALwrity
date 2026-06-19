import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const TermsOfServicePage: React.FC = () => (
  <LegalPageLayout
    title="Terms of Service"
    metaDescription="ALwrity Terms of Service — rules and conditions for using our AI digital marketing operating system."
    canonicalPath="/terms"
  >
    <p>
      By accessing or using ALwrity, you agree to these Terms of Service. If you do not agree, please
      do not use the platform.
    </p>

    <h2>Use of the Service</h2>
    <ul>
      <li>You must provide accurate account information and keep credentials secure</li>
      <li>You are responsible for content you create, publish, or distribute through ALwrity</li>
      <li>You may not use ALwrity for unlawful, harmful, or abusive purposes</li>
      <li>AI-generated outputs should be reviewed before publication; you remain responsible for final content</li>
    </ul>

    <h2>Subscriptions &amp; Billing</h2>
    <p>
      Free and paid plans may be offered. Paid features, pricing, and billing terms are described on
      our Pricing page. Subscriptions renew according to the plan you select unless cancelled.
    </p>

    <h2>Intellectual Property</h2>
    <p>
      ALwrity software, branding, and platform design are owned by ALwrity and its contributors.
      Open-source components are subject to their respective licenses. You retain ownership of content
      you create using the platform.
    </p>

    <h2>Disclaimer</h2>
    <p>
      ALwrity is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
      uninterrupted service or error-free AI outputs. Use professional judgment when acting on
      AI-generated recommendations.
    </p>

    <h2>Contact</h2>
    <p>
      Questions about these terms? Email{' '}
      <a href="mailto:info@alwrity.com">info@alwrity.com</a>.
    </p>
  </LegalPageLayout>
);

export default TermsOfServicePage;
