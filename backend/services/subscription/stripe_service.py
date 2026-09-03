import json
import os
import stripe
from typing import Optional, Dict, Any
from loguru import logger
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from models.subscription_models import UserSubscription, SubscriptionPlan, SubscriptionTier, BillingCycle, UsageStatus, FraudWarning, ProcessedStripeEvent
from services.subscription.pricing_service import PricingService
from datetime import datetime, timedelta

REQUIRED_STRIPE_PLAN_KEYS = {
    (SubscriptionTier.BASIC.value, BillingCycle.MONTHLY.value),
    (SubscriptionTier.PRO.value, BillingCycle.MONTHLY.value),
}


def _is_truthy_env(var_name: str) -> bool:
    return os.getenv(var_name, "").strip().lower() in {"1", "true", "yes", "on"}


def _detect_stripe_mode() -> str:
    configured_mode = os.getenv("STRIPE_MODE", "").strip().lower()
    if configured_mode in {"test", "live"}:
        return configured_mode

    secret_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
    if secret_key.startswith("sk_live_"):
        return "live"
    if secret_key.startswith("sk_test_"):
        return "test"

    # Default to test when mode cannot be derived.
    return "test"


def _normalize_stripe_plan_price_mapping(raw_mapping: Dict[str, Any]) -> Dict[tuple[str, str], str]:
    normalized_mapping: Dict[tuple[str, str], str] = {}

    for tier, billing_cycle_map in raw_mapping.items():
        if not isinstance(billing_cycle_map, dict):
            raise RuntimeError(
                "Stripe plan mapping must be nested JSON in the form "
                '{"basic": {"monthly": "price_..."}}.'
            )

        for billing_cycle, price_id in billing_cycle_map.items():
            if not isinstance(price_id, str) or not price_id.strip():
                raise RuntimeError(
                    f"Invalid Stripe price id for tier={tier}, billing_cycle={billing_cycle}."
                )
            normalized_mapping[(tier, billing_cycle)] = price_id.strip()

    return normalized_mapping


def _load_stripe_plan_price_mapping() -> Dict[tuple[str, str], str]:
    stripe_mode = _detect_stripe_mode()
    mode_var_name = f"STRIPE_PLAN_PRICE_MAPPING_{stripe_mode.upper()}"
    raw_mapping_json = os.getenv(mode_var_name) or os.getenv("STRIPE_PLAN_PRICE_MAPPING")

    if not raw_mapping_json:
        raise RuntimeError(
            "Missing Stripe plan mapping configuration. Set "
            f"{mode_var_name} (recommended) or STRIPE_PLAN_PRICE_MAPPING."
        )

    try:
        parsed_mapping = json.loads(raw_mapping_json)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid JSON in {mode_var_name}/STRIPE_PLAN_PRICE_MAPPING: {exc.msg}"
        ) from exc

    if not isinstance(parsed_mapping, dict):
        raise RuntimeError("Stripe plan mapping must decode to a JSON object.")

    mapping = _normalize_stripe_plan_price_mapping(parsed_mapping)
    missing_keys = REQUIRED_STRIPE_PLAN_KEYS - set(mapping.keys())
    if missing_keys:
        missing = ", ".join(
            sorted([f"{tier}:{billing_cycle}" for tier, billing_cycle in missing_keys])
        )
        raise RuntimeError(
            "Stripe plan mapping is missing required tier/cycle combinations: "
            f"{missing}."
        )

    return mapping


_STRIPE_MAPPING: Optional[Dict[tuple[str, str], str]] = None
_STRIPE_PRICE_TO_PLAN: Optional[Dict] = None


def _get_stripe_plan_price_mapping() -> Dict[tuple[str, str], str]:
    """Load Stripe plan mapping lazily so module import never fails."""
    global _STRIPE_MAPPING, _STRIPE_PRICE_TO_PLAN
    if _STRIPE_MAPPING is not None:
        return _STRIPE_MAPPING
    _STRIPE_MAPPING = _load_stripe_plan_price_mapping()
    _STRIPE_PRICE_TO_PLAN = {
        price_id: {"tier": SubscriptionTier(tier), "billing_cycle": BillingCycle(billing_cycle)}
        for (tier, billing_cycle), price_id in _STRIPE_MAPPING.items()
    }
    return _STRIPE_MAPPING


def _get_stripe_price_to_plan() -> dict:
    _get_stripe_plan_price_mapping()
    return _STRIPE_PRICE_TO_PLAN

class StripeService:
    def __init__(self, db: Session):
        self.db = db
        self.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        self.require_stripe_checkout = _is_truthy_env("REQUIRE_STRIPE_CHECKOUT")
        if not self.api_key:
            if self.require_stripe_checkout:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "REQUIRE_STRIPE_CHECKOUT=true but STRIPE_SECRET_KEY is missing. "
                        "Configure STRIPE_SECRET_KEY to enable Stripe checkout."
                    ),
                )
            logger.warning("STRIPE_SECRET_KEY is not set. Stripe integration will not work.")
        else:
            stripe.api_key = self.api_key

    def _get_price_id_for_plan(self, tier: SubscriptionTier, billing_cycle: BillingCycle) -> str:
        key = (tier.value, billing_cycle.value)
        price_id = _get_stripe_plan_price_mapping().get(key)
        if not price_id:
            logger.error(f"No Stripe price configured for tier={tier.value}, billing_cycle={billing_cycle.value}")
            raise HTTPException(status_code=400, detail="Payment plan is not configured")
        return price_id

    def _get_plan_for_price_id(self, price_id: str) -> tuple[SubscriptionPlan, BillingCycle]:
        price_to_plan = _get_stripe_price_to_plan()
        mapping = price_to_plan.get(price_id)
        if not mapping:
            logger.error(f"Unknown Stripe price_id: {price_id}")
            raise HTTPException(status_code=400, detail="Unknown payment price configuration")
        tier = mapping["tier"]
        billing_cycle = mapping["billing_cycle"]
        plan = (
            self.db.query(SubscriptionPlan)
            .filter(SubscriptionPlan.tier == tier, SubscriptionPlan.is_active == True)
            .order_by(SubscriptionPlan.price_monthly)
            .first()
        )
        if not plan:
            logger.error(f"No subscription plan found for tier={tier.value}")
            raise HTTPException(status_code=400, detail="Subscription plan not found for payment price")
        return plan, billing_cycle

    def _get_or_create_customer(self, user_id: str, email: Optional[str] = None) -> str:
        """
        Get existing Stripe customer ID for user, or create a new one.
        """
        subscription = self.db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()

        if subscription and subscription.stripe_customer_id:
            return subscription.stripe_customer_id

        # Search Stripe for existing customer by email (if provided) or metadata
        try:
            # If we have an email, search by email first
            if email:
                existing_customers = stripe.Customer.list(email=email, limit=1)
                if existing_customers and len(existing_customers.data) > 0:
                    customer = existing_customers.data[0]
                    # Update DB
                    if subscription:
                        subscription.stripe_customer_id = customer.id
                        self.db.commit()
                    return customer.id
            
            # Search by metadata user_id
            existing_customers = stripe.Customer.search(
                query=f"metadata['user_id']:'{user_id}'", 
                limit=1
            )
            if existing_customers and len(existing_customers.data) > 0:
                customer = existing_customers.data[0]
                if subscription:
                    subscription.stripe_customer_id = customer.id
                    self.db.commit()
                return customer.id

        except Exception as e:
            logger.error(f"Error searching Stripe customer: {e}")

        # Create new customer
        try:
            customer_data = {
                "metadata": {"user_id": user_id},
            }
            if email:
                customer_data["email"] = email
                
            customer = stripe.Customer.create(**customer_data)
            
            # Update DB
            if subscription:
                subscription.stripe_customer_id = customer.id
            else:
                # Create a placeholder subscription record if none exists (usually created on signup/free tier)
                # But typically we expect a free tier record to exist.
                pass 
                
            self.db.commit()
            return customer.id
        except Exception as e:
            logger.error(f"Error creating Stripe customer: {e}")
            raise HTTPException(status_code=500, detail="Failed to create payment profile")

    def create_checkout_session(
        self,
        user_id: str,
        tier: SubscriptionTier,
        billing_cycle: BillingCycle,
        success_url: str,
        cancel_url: str,
        user_email: Optional[str] = None,
    ) -> str:
        """
        Create a Stripe Checkout Session for a subscription.
        """
        if not self.api_key:
            raise HTTPException(status_code=500, detail="Payment service not configured")

        price_id = self._get_price_id_for_plan(tier, billing_cycle)
        customer_id = self._get_or_create_customer(user_id, user_email)

        line_item: Dict[str, Any] = {"price": price_id}
        try:
            price = stripe.Price.retrieve(price_id)
            recurring = getattr(price, "recurring", None)
            usage_type = None
            if recurring:
                if isinstance(recurring, dict):
                    usage_type = recurring.get("usage_type")
                else:
                    usage_type = getattr(recurring, "usage_type", None)
            if usage_type != "metered":
                line_item["quantity"] = 1
            else:
                logger.info(f"Detected metered price {price_id}; omitting quantity in Checkout line item")
        except Exception as e:
            logger.error(f"Error inspecting Stripe price {price_id}: {e}")
            line_item["quantity"] = 1

        try:
            checkout_session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[line_item],
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    "user_id": user_id,
                    "price_id": price_id,
                },
                subscription_data={
                    "metadata": {
                        "user_id": user_id,
                    }
                },
                allow_promotion_codes=True,
            )
            return checkout_session.url
        except Exception as e:
            logger.error(f"Error creating checkout session: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def create_portal_session(self, user_id: str, return_url: str) -> str:
        """
        Create a Stripe Customer Portal session for managing billing.
        """
        if not self.api_key:
            raise HTTPException(status_code=500, detail="Payment service not configured")

        subscription = self.db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).first()

        if not subscription or not subscription.stripe_customer_id:
            # Try to find customer by user_id if not in DB
            try:
                customers = stripe.Customer.search(query=f"metadata['user_id']:'{user_id}'", limit=1)
                if customers and len(customers.data) > 0:
                    customer_id = customers.data[0].id
                    # Update DB while we're at it
                    if subscription:
                        subscription.stripe_customer_id = customer_id
                        self.db.commit()
                else:
                    raise HTTPException(status_code=400, detail="No billing profile found for this user")
            except Exception as e:
                logger.error(f"Error finding customer for portal: {e}")
                raise HTTPException(status_code=500, detail="Failed to access billing portal")
        else:
            customer_id = subscription.stripe_customer_id

        try:
            portal_session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            return portal_session.url
        except Exception as e:
            logger.error(f"Error creating portal session: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def handle_webhook(self, payload: bytes, sig_header: str):
        """
        Handle Stripe webhooks.
        """
        if not self.webhook_secret:
            logger.warning("STRIPE_WEBHOOK_SECRET not set. Ignoring webhook.")
            return

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret
            )
        except ValueError as e:
            logger.error(f"Invalid payload: {e}")
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")

        event_id = event.get("id")
        event_type = event["type"]
        data = event["data"]["object"]

        if not event_id:
            logger.error("Stripe webhook event missing id")
            raise HTTPException(status_code=400, detail="Missing event id")

        now = datetime.utcnow()
        processed_event = self.db.query(ProcessedStripeEvent).filter(
            ProcessedStripeEvent.event_id == event_id
        ).first()

        if processed_event and processed_event.status == "processed":
            logger.info(f"Skipping already processed Stripe event {event_id}")
            return {"status": "success"}

        if processed_event:
            processed_event.status = "processing"
            processed_event.processing_started_at = now
            processed_event.last_error = None
            processed_event.attempt_count = (processed_event.attempt_count or 0) + 1
        else:
            processed_event = ProcessedStripeEvent(
                event_id=event_id,
                event_type=event_type,
                status="processing",
                received_at=now,
                processing_started_at=now,
                attempt_count=1,
            )
            self.db.add(processed_event)

        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            existing_event = self.db.query(ProcessedStripeEvent).filter(
                ProcessedStripeEvent.event_id == event_id
            ).first()
            if existing_event and existing_event.status == "processed":
                logger.info(f"Skipping already processed Stripe event {event_id} after race")
                return {"status": "success"}
            raise

        logger.info(f"Received Stripe webhook: {event_type}")

        try:
            if event_type == "checkout.session.completed":
                await self._handle_checkout_completed(data)
            elif event_type == "invoice.payment_succeeded":
                await self._handle_invoice_payment_succeeded(data)
            elif event_type == "invoice.payment_failed":
                await self._handle_invoice_payment_failed(data)
            elif event_type == "customer.subscription.updated":
                await self._handle_subscription_updated(data)
            elif event_type == "customer.subscription.deleted":
                await self._handle_subscription_deleted(data)
            elif event_type.startswith("radar.early_fraud_warning."):
                await self._handle_early_fraud_warning(data)

            processed_event.status = "processed"
            processed_event.processed_at = datetime.utcnow()
            processed_event.last_error = None
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            failed_event = self.db.query(ProcessedStripeEvent).filter(
                ProcessedStripeEvent.event_id == event_id
            ).first()
            if failed_event:
                failed_event.status = "failed"
                failed_event.last_error = str(e)[:2000]
                failed_event.processed_at = datetime.utcnow()
                self.db.commit()
            raise

        return {"status": "success"}

    async def _handle_checkout_completed(self, session: Dict[str, Any]):
        """
        Handle successful checkout.
        """
        user_id = session.get("metadata", {}).get("user_id")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        
        if not user_id:
            logger.error("No user_id in checkout session metadata")
            return

        logger.info(f"Checkout completed for user {user_id}")
        
        # Retrieve subscription details to get the plan/price
        if subscription_id:
            try:
                sub = stripe.Subscription.retrieve(subscription_id)
                price_id = sub['items']['data'][0]['price']['id']
                
                # Update DB
                self._update_user_subscription(
                    user_id, 
                    stripe_customer_id=customer_id,
                    stripe_subscription_id=subscription_id,
                    status="active",
                    price_id=price_id
                )
                
                # Clear PricingService cache so next status check returns updated limits
                try:
                    from services.subscription import PricingService
                    PricingService.clear_user_cache(user_id)
                except Exception as cache_err:
                    logger.warning(f"Failed to clear user cache after checkout for user {user_id}: {cache_err}")
                try:
                    from services.subscription.cache import clear_dashboard_cache
                    clear_dashboard_cache(user_id)
                    logger.info(f"Cleared dashboard cache for user {user_id} after checkout")
                except Exception as cache_err:
                    logger.warning(f"Failed to clear cache after checkout for user {user_id}: {cache_err}")
                
# Expire all SQLAlchemy objects to force fresh reads
                self.db.expire_all()
                logger.info(f"Expired all SQLAlchemy objects for user {user_id} after checkout")

                # Best-effort, non-blocking payment-confirmation email. A send
                # failure must never break the checkout/webhook flow.
                try:
                    from services.subscription.billing_email import send_billing_email
                    send_billing_email(
                        user_id,
                        db=self.db,
                        kind="payment_confirmation",
                        event_ref=str(session.get("id") or ""),
                    )
                    logger.info(f"Payment-confirmation email sent for user {user_id}")
                except Exception as email_err:
                    logger.warning(f"Payment-confirmation email skipped for {user_id}: {email_err}")

            except Exception as e:
                logger.error(f"Error processing checkout subscription: {e}")

    async def _handle_invoice_payment_succeeded(self, invoice: Dict[str, Any]):
        """
        Handle recurring payment success.
        """
        subscription_id = invoice.get("subscription")
        customer_id = invoice.get("customer")
        
        if not subscription_id:
            return

        # Find user by stripe_subscription_id or customer_id
        subscription = self.db.query(UserSubscription).filter(
            (UserSubscription.stripe_subscription_id == subscription_id) |
            (UserSubscription.stripe_customer_id == customer_id)
        ).first()

        if subscription:
            logger.info(f"Payment succeeded for user {subscription.user_id}")
            subscription.status = UsageStatus.ACTIVE
            subscription.is_active = True
            subscription.auto_renew = True
            # Update period start/end based on invoice lines period
            if invoice.get('lines'):
                 period_start = invoice['lines']['data'][0]['period']['start']
                 period_end = invoice['lines']['data'][0]['period']['end']
                 subscription.current_period_start = datetime.fromtimestamp(period_start)
                 subscription.current_period_end = datetime.fromtimestamp(period_end)
            self.db.commit()
            
            # Clear PricingService cache so next status check returns updated limits
            try:
                from services.subscription import PricingService
                PricingService.clear_user_cache(subscription.user_id)
                logger.info(f"Cleared subscription cache for user {subscription.user_id} after payment success")
            except Exception as cache_err:
                logger.warning(f"Failed to clear user cache after payment success for user {subscription.user_id}: {cache_err}")
            try:
                from services.subscription.cache import clear_dashboard_cache
                clear_dashboard_cache(subscription.user_id)
            except Exception as dash_cache_err:
                logger.warning(f"Failed to clear dashboard cache after payment success for user {subscription.user_id}: {dash_cache_err}")
            # Best-effort renewal-receipt email for recurring charges. The initial
            # payment (subscription_create) is covered by the Phase-1
            # payment-confirmation email, so skip that here to avoid duplicates.
            try:
                self._send_renewal_receipt_from_webhook(subscription, invoice)
            except Exception as receipt_err:
                logger.warning(f"Renewal-receipt email skipped for user {subscription.user_id}: {receipt_err}")
            self.db.expire_all()

    async def _handle_invoice_payment_failed(self, invoice: Dict[str, Any]):
        subscription_id = invoice.get("subscription")
        customer_id = invoice.get("customer")

        if not subscription_id:
            return

        subscription = self.db.query(UserSubscription).filter(
            (UserSubscription.stripe_subscription_id == subscription_id) |
            (UserSubscription.stripe_customer_id == customer_id)
        ).first()

        if subscription:
            logger.warning(f"Payment failed for user {subscription.user_id}")
            subscription.status = UsageStatus.PAST_DUE
            subscription.is_active = False
            self.db.commit()

            # Best-effort payment-failure email.
            try:
                self._send_payment_failed_from_webhook(subscription, invoice)
            except Exception as fail_err:
                logger.warning(f"Payment-failure email skipped for user {subscription.user_id}: {fail_err}")

    async def _handle_subscription_updated(self, subscription_obj: Dict[str, Any]):
        """
        Handle subscription updates (cancellations, changes).
        """
        stripe_sub_id = subscription_obj.get("id")
        status = subscription_obj.get("status")
        
        subscription = self.db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == stripe_sub_id
        ).first()

        if subscription:
            logger.info(f"Subscription {stripe_sub_id} updated to {status}")

            # Capture previous plan BEFORE mutation so we can detect a real
            # plan change (upgrade / downgrade) for the notification email.
            previous_plan_name = ""
            previous_plan_tier = ""
            try:
                prev = subscription.plan
                if prev is not None:
                    previous_plan_name = getattr(prev, "name", "") or ""
                    try:
                        previous_plan_tier = str(prev.tier.value if hasattr(prev.tier, "value") else prev.tier)
                    except Exception:
                        previous_plan_tier = ""
            except Exception:
                pass

            if status in ["active", "trialing"]:
                subscription.status = UsageStatus.ACTIVE
                subscription.is_active = True
                subscription.auto_renew = True
                # Update period boundaries from Stripe event
                current_period = subscription_obj.get("current_period", {})
                if current_period:
                    subscription.current_period_start = datetime.fromtimestamp(current_period.get("start", 0))
                    subscription.current_period_end = datetime.fromtimestamp(current_period.get("end", 0))
            elif status in ["past_due", "unpaid", "incomplete", "incomplete_expired"]:
                subscription.status = UsageStatus.PAST_DUE
                subscription.is_active = False
            elif status in ["canceled"]:
                subscription.status = UsageStatus.CANCELLED
                subscription.is_active = False
                subscription.auto_renew = False

            self.db.commit()

            # Best-effort plan-change notification for Stripe self-serve plan
            # switches (only when the plan actually changed).
            try:
                self._send_plan_change_from_webhook(subscription, subscription_obj, previous_plan_name, previous_plan_tier)
            except Exception as plan_err:
                logger.warning(f"Plan-change email skipped for user {subscription.user_id}: {plan_err}")

            # Clear PricingService cache so next status check returns updated limits
            try:
                from services.subscription import PricingService
                PricingService.clear_user_cache(subscription.user_id)
                logger.info(f"Cleared subscription cache for user {subscription.user_id} after subscription update")
            except Exception as cache_err:
                logger.warning(f"Failed to clear user cache after subscription update for user {subscription.user_id}: {cache_err}")
            try:
                from services.subscription.cache import clear_dashboard_cache
                clear_dashboard_cache(subscription.user_id)
            except Exception as dash_cache_err:
                logger.warning(f"Failed to clear dashboard cache after subscription update for user {subscription.user_id}: {dash_cache_err}")
            self.db.expire_all()

    async def _handle_subscription_deleted(self, subscription_obj: Dict[str, Any]):
        """
        Handle subscription cancellation (immediate).
        """
        stripe_sub_id = subscription_obj.get("id")
        
        subscription = self.db.query(UserSubscription).filter(
            UserSubscription.stripe_subscription_id == stripe_sub_id
        ).first()

        if subscription:
            logger.info(f"Subscription {stripe_sub_id} deleted")
            subscription.status = UsageStatus.CANCELLED # Need to check if this enum value exists
            subscription.is_active = False
            subscription.auto_renew = False
            self.db.commit()

    async def _handle_early_fraud_warning(self, warning_obj: Dict[str, Any]):
        efw_id = warning_obj.get("id")
        if not efw_id:
            return

        charge_id = warning_obj.get("charge")
        payment_intent_id = warning_obj.get("payment_intent")
        created_ts = warning_obj.get("created")
        created_at = datetime.utcfromtimestamp(created_ts) if created_ts else datetime.utcnow()

        amount = 0
        currency = ""
        user_id = None
        charge_data: Dict[str, Any] = {}

        if charge_id and self.api_key:
            try:
                charge = stripe.Charge.retrieve(charge_id)
                charge_data = charge.to_dict() if hasattr(charge, "to_dict") else dict(charge)
                amount = charge_data.get("amount") or 0
                currency = charge_data.get("currency") or ""
                metadata = charge_data.get("metadata") or {}
                user_id = metadata.get("user_id")
            except Exception as e:
                logger.error(f"Error retrieving charge for early fraud warning {efw_id}: {e}")

        if not amount:
            amount = warning_obj.get("amount") or 0
        if not currency:
            currency = warning_obj.get("currency") or ""

        existing = self.db.query(FraudWarning).filter(FraudWarning.id == efw_id).first()

        metadata_payload: Dict[str, Any] = {
            "early_fraud_warning": warning_obj,
        }
        if charge_data:
            metadata_payload["charge"] = charge_data

        if existing:
            existing.charge_id = charge_id or existing.charge_id
            existing.payment_intent_id = payment_intent_id or existing.payment_intent_id
            if user_id:
                existing.user_id = user_id
            if amount:
                existing.amount = amount
            if currency:
                existing.currency = currency
            existing.status = "open"
            existing.meta_info = metadata_payload
        else:
            if not charge_id:
                return
            warning = FraudWarning(
                id=efw_id,
                charge_id=charge_id,
                payment_intent_id=payment_intent_id,
                user_id=user_id,
                amount=amount or 0,
                currency=currency or "",
                status="open",
                action="none",
                meta_info=metadata_payload,
                created_at=created_at,
            )
            self.db.add(warning)

        self.db.commit()

    def _send_plan_change_from_webhook(self, subscription, subscription_obj: Dict[str, Any],
                                       previous_plan_name: str, previous_plan_tier: str) -> None:
        """Detect a Stripe self-serve plan change and email the user (best-effort).

        Only emails when the plan truly changed (upgrade or downgrade), resolved
        from the Stripe subscription's current price. Never raises.
        """
        user_id = subscription.user_id

        # Resolve the new plan from the Stripe subscription's current price.
        try:
            items = subscription_obj.get("items", {}).get("data", [])
            price_id = items[0].get("price", {}).get("id") if items else None
            if not price_id:
                return
            new_plan, _ = self._get_plan_for_price_id(price_id)
        except Exception:
            return

        new_name = getattr(new_plan, "name", "") or ""
        try:
            new_tier = str(new_plan.tier.value if hasattr(new_plan.tier, "value") else new_plan.tier)
        except Exception:
            new_tier = ""

        # Same plan as before → no plan-change email.
        if new_name and new_name == previous_plan_name:
            return

        # Determine direction.
        tier_order = {"free": 0, "basic": 1, "pro": 2, "enterprise": 3}
        prev_order = tier_order.get((previous_plan_tier or "free").lower(), 0)
        new_order = tier_order.get((new_tier or "").lower(), 0)
        if new_order > prev_order:
            change_type = "upgrade"
        elif new_order < prev_order:
            change_type = "downgrade"
        else:
            change_type = "renewal"

        # Only email on an actual plan change (skip pure renewals).
        if change_type not in ("upgrade", "downgrade"):
            return

        try:
            items = subscription_obj.get("items", {}).get("data", [])
            interval = ""
            if items:
                interval = (items[0].get("price", {}).get("recurring", {}) or {}).get("interval", "")
            price = getattr(new_plan, "price_yearly", 0) if interval == "year" else getattr(new_plan, "price_monthly", 0)
            from services.subscription.billing_email import send_billing_email
            send_billing_email(
                user_id,
                db=self.db,
                kind="plan_change",
                event_ref=f"stripe-{subscription_obj.get('id', user_id)}",
                payload_extra={
                    "previous_plan_name": previous_plan_name or "",
                    "previous_plan_tier": previous_plan_tier or "",
                    "renewal_type": change_type,
                    "price": str(price),
                },
            )
            logger.info(f"Plan-change email ({change_type}) queued for user {user_id}")
        except Exception as e:
            logger.warning(f"Failed to send plan-change email for user {user_id}: {e}")

    def _send_renewal_receipt_from_webhook(self, subscription, invoice: Dict[str, Any]) -> None:
        """Send a renewal-receipt email for a successful recurring charge (best-effort).

        Skips when the invoice isn't a subscription cycle renewal (initial payments
        and plan-update invoices are covered by the payment-confirmation and
        plan-change emails respectively). Never raises.
        """
        user_id = subscription.user_id

        # Only recurring renewal charges get a receipt here.
        if invoice.get("billing_reason") and invoice.get("billing_reason") != "subscription_cycle":
            return

        try:
            # amount_paid is in minor units (cents).
            raw_amount = invoice.get("amount_paid", 0) or 0
            price = str(round(float(raw_amount) / 100.0, 2))

            # Billing period for the charge from the first invoice line.
            period_start = ""
            period_end = ""
            lines = invoice.get("lines", {})
            line_data = (lines.get("data") or []) if isinstance(lines, dict) else []
            if line_data:
                period = (line_data[0].get("period") or {})
                period_start = str(period.get("start", "") or "")
                period_end = str(period.get("end", "") or "")

            from services.subscription.billing_email import send_billing_email
            send_billing_email(
                user_id,
                db=self.db,
                kind="renewal_receipt",
                event_ref=f"invoice-{invoice.get('id', user_id)}",
                payload_extra={
                    "price": price,
                    "period_start": period_start,
                    "period_end": period_end,
                },
            )
            logger.info(f"Renewal-receipt email queued for user {user_id}")
        except Exception as e:
            logger.warning(f"Failed to send renewal-receipt email for user {user_id}: {e}")

    def _send_payment_failed_from_webhook(self, subscription, invoice: Dict[str, Any]) -> None:
        """Send a payment-failure email for a failed recurring charge (best-effort).

        Never raises.
        """
        user_id = subscription.user_id

        try:
            raw_amount = invoice.get("amount_due", 0) or 0
            price = str(round(float(raw_amount) / 100.0, 2))

            last_error = invoice.get("last_payment_error") or {}
            failure_reason = last_error.get("message", "") or ""

            from services.subscription.billing_email import send_billing_email
            send_billing_email(
                user_id,
                db=self.db,
                kind="payment_failed",
                event_ref=f"failed-{invoice.get('id', user_id)}",
                payload_extra={
                    "price": price,
                    "failure_reason": failure_reason,
                },
            )
            logger.info(f"Payment-failure email queued for user {user_id}")
        except Exception as e:
            logger.warning(f"Failed to send payment-failure email for user {user_id}: {e}")

    def _update_user_subscription(
        self,
        user_id: str,
        stripe_customer_id: str,
        stripe_subscription_id: str,
        status: str,
        price_id: str,
    ):
        plan, billing_cycle = self._get_plan_for_price_id(price_id)

        subscription = (
            self.db.query(UserSubscription)
            .filter(UserSubscription.user_id == user_id)
            .first()
        )

        now = datetime.utcnow()
        # Calculate billing period end based on cycle
        if billing_cycle == BillingCycle.YEARLY:
            period_end = now + timedelta(days=365)
        else:
            period_end = now + timedelta(days=30)

        if not subscription:
            subscription = UserSubscription(
                user_id=user_id,
                plan_id=plan.id,
                billing_cycle=billing_cycle,
                current_period_start=now,
                current_period_end=period_end,
                status=UsageStatus.ACTIVE if status == "active" else UsageStatus.SUSPENDED,
                is_active=status == "active",
                auto_renew=True,
            )
            self.db.add(subscription)
        else:
            subscription.plan_id = plan.id
            subscription.billing_cycle = billing_cycle
            subscription.is_active = status == "active"
            subscription.status = UsageStatus.ACTIVE if status == "active" else UsageStatus.SUSPENDED
            # Reset billing period on upgrade/plan change
            subscription.current_period_start = now
            subscription.current_period_end = period_end
            subscription.auto_renew = True

        subscription.stripe_customer_id = stripe_customer_id
        subscription.stripe_subscription_id = stripe_subscription_id

        self.db.commit()
