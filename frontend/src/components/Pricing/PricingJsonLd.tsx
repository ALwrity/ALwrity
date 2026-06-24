import { useEffect } from 'react';
import type { SubscriptionPlan } from './pricingTypes';

const SCRIPT_ID = 'pricing-json-ld';

interface PricingJsonLdProps {
  plans: SubscriptionPlan[];
}

export default function PricingJsonLd({ plans }: PricingJsonLdProps) {
  useEffect(() => {
    if (plans.length === 0) return;

    const offers = plans.map((plan) => ({
      '@type': 'Offer',
      name: `${plan.name} Plan`,
      price: plan.price_monthly,
      priceCurrency: 'USD',
      description: plan.description,
      url: 'https://www.alwrity.com/pricing',
    }));

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'ALwrity AI Marketing Platform',
      description:
        'AI marketing platform with content creation, SEO, publishing, and analytics. Free, Basic, Pro, and Enterprise plans.',
      brand: { '@type': 'Brand', name: 'ALwrity' },
      offers: {
        '@type': 'AggregateOffer',
        offerCount: offers.length,
        lowPrice: 0,
        highPrice: Math.max(...plans.map((p) => p.price_monthly)),
        priceCurrency: 'USD',
        offers,
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
  }, [plans]);

  return null;
}
