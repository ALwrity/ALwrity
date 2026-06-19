import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PrivacyPolicyPage: React.FC = () => (
  <LegalPageLayout
    title="Privacy Policy"
    metaDescription="ALwrity Privacy Policy — how we collect, use, and protect your data on our AI digital marketing platform."
    canonicalPath="/privacy"
  >
    <p>
      ALwrity (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy
      Policy explains how we handle information when you use the ALwrity AI digital marketing platform
      at alwrity.com and related services.
    </p>

    <h2>Information We Collect</h2>
    <p>We may collect:</p>
    <ul>
      <li>Account information (name, email) provided during sign-up via our authentication provider</li>
      <li>Content you create, upload, or generate using ALwrity tools</li>
      <li>Usage data such as feature interactions, logs, and performance metrics</li>
      <li>API keys you optionally provide (Bring Your Own Keys model)</li>
    </ul>

    <h2>How We Use Your Information</h2>
    <ul>
      <li>To provide, maintain, and improve ALwrity services</li>
      <li>To personalize your experience and brand-voice settings</li>
      <li>To communicate service updates and respond to support requests</li>
      <li>To ensure security and prevent abuse</li>
    </ul>

    <h2>Data Sharing</h2>
    <p>
      We do not sell your personal data. We may share data with trusted service providers (e.g.,
      authentication, hosting, AI model providers) only as needed to operate the platform, and always
      under appropriate safeguards.
    </p>

    <h2>Your Rights</h2>
    <p>
      Depending on your location, you may have rights to access, correct, delete, or export your data.
      Contact us at info@alwrity.com to exercise these rights.
    </p>

    <h2>Contact</h2>
    <p>
      For privacy-related inquiries, email{' '}
      <a href="mailto:info@alwrity.com">info@alwrity.com</a>.
    </p>
  </LegalPageLayout>
);

export default PrivacyPolicyPage;
