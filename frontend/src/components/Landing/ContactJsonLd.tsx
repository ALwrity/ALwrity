import { useEffect } from 'react';

const SCRIPT_ID = 'contact-page-json-ld';

export default function ContactJsonLd() {
  useEffect(() => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Contact ALwrity',
      url: 'https://www.alwrity.com/contact',
      mainEntity: {
        '@type': 'Organization',
        name: 'ALwrity',
        email: 'info@alwrity.com',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'info@alwrity.com',
          availableLanguage: 'English',
        },
      },
    };

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, []);

  return null;
}
