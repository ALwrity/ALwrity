export interface PlanPriceFields {
  price_monthly: number;
  price_yearly: number;
}

export interface PlanPriceDisplay {
  amount: string;
  periodLabel: string;
  billingNote?: string;
  savingsAmount?: number;
}

function formatPriceAmount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/** Monthly tab shows monthly rate; Annual tab shows monthly equivalent with annual billing note. */
export function getPlanPriceDisplay(plan: PlanPriceFields, yearlyBilling: boolean): PlanPriceDisplay {
  if (yearlyBilling) {
    const savings = plan.price_monthly > 0 ? plan.price_monthly * 12 - plan.price_yearly : 0;
    const monthlyEquivalent = plan.price_yearly / 12;

    return {
      amount: formatPriceAmount(monthlyEquivalent),
      periodLabel: 'month',
      billingNote:
        plan.price_monthly > 0
          ? `Billed annually ($${formatPriceAmount(plan.price_yearly)}/yr)`
          : undefined,
      savingsAmount: savings > 0 ? savings : undefined,
    };
  }

  return {
    amount: formatPriceAmount(plan.price_monthly),
    periodLabel: 'month',
  };
}
