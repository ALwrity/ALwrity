import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Chip,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import { apiClient, getApiUrl } from "../../../api/client";
import type { SubscriptionPlan } from "../pricingTypes";
import {
  LINKEDIN_FEATURES,
  LINKEDIN_PRICING_HERO,
  type LinkedInPlanFeature,
} from "../linkedinFeatureMap";

const LINKEDIN_PRIMARY = "#0a66c2";
const LINKEDIN_HOVER = "#004182";

export const LinkedInPricingPage: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [yearly, setYearly] = useState(false);

  const { isSignedIn, user } = useClerk();
  const navigate = useNavigate();

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let responseData: { data?: { plans: SubscriptionPlan[] } };
      try {
        const response = await apiClient.get("/api/subscription/plans");
        responseData = response.data;
      } catch {
        const base = getApiUrl();
        const res = await fetch(`${base}/api/subscription/plans`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Failed to load plans");
        responseData = await res.json();
      }
      const allPlans = responseData.data?.plans ?? [];
      const linkedinPlans = allPlans.filter(
        (p: SubscriptionPlan) => p.tier === "free" || p.tier === "basic"
      );
      setPlans(linkedinPlans);
    } catch (err) {
      console.error("LinkedInPricing: failed to fetch plans", err);
      setError("Couldn't load plans. Please refresh or email info@alwrity.com");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSubscribe = async (planId: number) => {
    if (!isSignedIn || !user) {
      navigate("/sign-in?redirect=/linkedin-studio/pricing");
      return;
    }
    try {
      setSubscribing(true);
      await apiClient.post(`/api/subscription/subscribe/${user.id}`, {
        plan_id: planId,
      });
      navigate("/linkedin-studio");
    } catch (err) {
      console.error("LinkedInPricing: subscribe failed", err);
      setError("Subscription failed. Please try again or email info@alwrity.com");
    } finally {
      setSubscribing(false);
    }
  };

  const planOrder = ["free", "basic"];
  const sorted = [...plans].sort(
    (a, b) => planOrder.indexOf(a.tier) - planOrder.indexOf(b.tier)
  );

  const price = (plan: SubscriptionPlan) =>
    yearly ? plan.price_yearly : plan.price_monthly;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ pt: 8, textAlign: "center" }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" onClick={fetchPlans}>
          Retry
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ bgcolor: "#f8fafc", minHeight: "100vh" }}>
      {/* Hero */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${LINKEDIN_PRIMARY} 0%, #023b66 100%)`,
          color: "#fff",
          textAlign: "center",
          py: { xs: 6, md: 8 },
          px: 2,
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h2"
            component="h1"
            sx={{ fontWeight: 800, fontSize: { xs: 28, md: 40 }, mb: 2 }}
          >
            {LINKEDIN_PRICING_HERO.title}
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontWeight: 400, opacity: 0.9, fontSize: { xs: 16, md: 20 }, mb: 1 }}
          >
            {LINKEDIN_PRICING_HERO.subtitle}
          </Typography>
          <Chip
            label="All plans unlock LinkedIn Studio. Limits reset monthly."
            size="small"
            sx={{
              bgcolor: "rgba(255,255,255,0.15)",
              color: "#fff",
              mt: 1,
              fontWeight: 500,
            }}
          />
        </Container>
      </Box>

      {/* Billing Toggle */}
      <Container maxWidth="md" sx={{ py: 3, textAlign: "center" }}>
        <Button
          variant={yearly ? "contained" : "outlined"}
          onClick={() => setYearly(true)}
          sx={{
            mr: 1,
            borderRadius: "20px 0 0 20px",
            textTransform: "none",
            fontWeight: 600,
            ...(yearly
              ? { bgcolor: LINKEDIN_PRIMARY, "&:hover": { bgcolor: LINKEDIN_HOVER } }
              : { color: LINKEDIN_PRIMARY, borderColor: LINKEDIN_PRIMARY }),
          }}
        >
          Yearly (save 17%)
        </Button>
        <Button
          variant={!yearly ? "contained" : "outlined"}
          onClick={() => setYearly(false)}
          sx={{
            borderRadius: "0 20px 20px 0",
            textTransform: "none",
            fontWeight: 600,
            ...(!yearly
              ? { bgcolor: LINKEDIN_PRIMARY, "&:hover": { bgcolor: LINKEDIN_HOVER } }
              : { color: LINKEDIN_PRIMARY, borderColor: LINKEDIN_PRIMARY }),
          }}
        >
          Monthly
        </Button>
      </Container>

      {/* Plan Cards */}
      <Container maxWidth="md" sx={{ pb: 4 }}>
        <Box
          sx={{
            display: "flex",
            gap: 3,
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "stretch",
          }}
        >
          {sorted.map((plan) => {
            const planPrice = price(plan);
            const isFree = plan.tier === "free";
            return (
              <Paper
                key={plan.id}
                elevation={isFree ? 1 : 4}
                sx={{
                  flex: { xs: "1 1 100%", md: "1 1 320px" },
                  maxWidth: 380,
                  borderRadius: 3,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  border: isFree ? "1px solid #e2e8f0" : `2px solid ${LINKEDIN_PRIMARY}`,
                }}
              >
                {/* Card Header */}
                <Box sx={{ p: 3, textAlign: "center", bgcolor: isFree ? "#f8fafc" : LINKEDIN_PRIMARY }}>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: isFree ? "#0f172a" : "#fff",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      fontSize: 14,
                    }}
                  >
                    {plan.name}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 40,
                        fontWeight: 800,
                        color: isFree ? "#0f172a" : "#fff",
                      }}
                    >
                      {planPrice === 0 ? "Free" : `$${planPrice}`}
                    </Typography>
                    {planPrice > 0 && (
                      <Typography
                        component="span"
                        sx={{ fontSize: 16, color: isFree ? "#64748b" : "rgba(255,255,255,0.8)", ml: 0.5 }}
                      >
                        /mo
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 13,
                      mt: 1,
                      color: isFree ? "#64748b" : "rgba(255,255,255,0.8)",
                      minHeight: 36,
                    }}
                  >
                    {plan.description || (isFree ? "Get started with LinkedIn Studio" : "Everything you need to grow on LinkedIn")}
                  </Typography>
                </Box>

                {/* Subscribe CTA */}
                <Box sx={{ p: 2 }}>
                  <Button
                    fullWidth
                    variant={isFree ? "outlined" : "contained"}
                    disabled={subscribing}
                    onClick={() => handleSubscribe(plan.id)}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: "none",
                      fontWeight: 700,
                      fontSize: 15,
                      ...(isFree
                        ? { borderColor: LINKEDIN_PRIMARY, color: LINKEDIN_PRIMARY }
                        : { bgcolor: LINKEDIN_PRIMARY, "&:hover": { bgcolor: LINKEDIN_HOVER } }),
                    }}
                  >
                    {subscribing ? "Subscribing…" : isFree ? "Start Free" : "Upgrade to Basic"}
                  </Button>
                </Box>

                {/* Feature List */}
                <Box sx={{ px: 3, pb: 3, flex: 1 }}>
                  {LINKEDIN_FEATURES.map((feature) => {
                    const value = plan.tier === "free" ? feature.free : feature.basic;
                    const hasFeature = value !== "—";
                    return (
                      <Box
                        key={feature.label}
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1.5,
                          py: 0.8,
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        {hasFeature ? (
                          <CheckIcon sx={{ fontSize: 18, color: "#10b981", mt: 0.3, flexShrink: 0 }} />
                        ) : (
                          <CloseIcon sx={{ fontSize: 18, color: "#d1d5db", mt: 0.3, flexShrink: 0 }} />
                        )}
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                              {feature.label}
                            </Typography>
                            {feature.tooltip && (
                              <Tooltip title={feature.tooltip} arrow placement="top">
                                <InfoOutlinedIcon sx={{ fontSize: 14, color: "#94a3b8" }} />
                              </Tooltip>
                            )}
                          </Box>
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: hasFeature ? "#64748b" : "#d1d5db",
                              fontWeight: hasFeature ? 400 : 500,
                            }}
                          >
                            {value}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
};

export default LinkedInPricingPage;
