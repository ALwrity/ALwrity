import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tabs, Tab } from '@mui/material';
import { apiClient } from '../api/client';

interface Dispute {
  id: string;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  charge?: string | null;
  created: number;
  is_charge_refundable?: boolean;
  evidence?: {
    customer_email_address?: string | null;
    customer_name?: string | null;
    customer_purchase_ip?: string | null;
    access_activity_log?: string | null;
    uncategorized_text?: string | null;
  } | null;
}

interface DisputeListResponse {
  data: {
    object: string;
    url: string;
    has_more: boolean;
    data: Dispute[];
  };
}

interface DisputeResponse {
  data: Dispute;
}

interface FraudWarning {
  id: string;
  charge_id: string;
  payment_intent_id: string | null;
  user_id: string | null;
  amount: number;
  currency: string;
  status: string;
  action: string;
  action_at: string | null;
  reason_notes?: string | null;
  created_at: string | null;
  meta_info?: any;
}

interface FraudWarningListResponse {
  data: FraudWarning[];
}

interface FraudWarningResponse {
  data: FraudWarning;
}

const StripeDisputesDashboard: React.FC = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [closing, setClosing] = useState(false);
  const [evidenceEmail, setEvidenceEmail] = useState('');
  const [evidenceName, setEvidenceName] = useState('');
  const [evidenceIp, setEvidenceIp] = useState('');
  const [evidenceLog, setEvidenceLog] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [fraudType, setFraudType] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [tab, setTab] = useState<'disputes' | 'fraudWarnings'>('disputes');
  const [fraudWarnings, setFraudWarnings] = useState<FraudWarning[]>([]);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState<FraudWarning | null>(null);
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [ignoreProcessing, setIgnoreProcessing] = useState(false);
  const [actionNotes, setActionNotes] = useState('');

  const loadDisputes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<DisputeListResponse>('/api/subscription/disputes', {
        params: { limit: 20 },
      });
      const list = response.data?.data;
      setDisputes(Array.isArray(list?.data) ? list.data : []);
    } catch (e: any) {
      const message = e?.message || 'Failed to load disputes';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadDisputeDetails = async (id: string) => {
    setError(null);
    try {
      const response = await apiClient.get<DisputeResponse>(`/api/subscription/disputes/${id}`);
      if (response.data?.data) {
        setSelectedDispute(response.data.data);
      }
    } catch (e: any) {
      const message = e?.message || 'Failed to load dispute details';
      setError(message);
    }
  };

  const handleViewDetails = (id: string) => {
    loadDisputeDetails(id);
  };

  const handleCloseDispute = async () => {
    if (!selectedDispute) return;
    setClosing(true);
    setError(null);
    try {
      await apiClient.post(`/api/subscription/disputes/${selectedDispute.id}/close`);
      await loadDisputes();
      setSelectedDispute(null);
    } catch (e: any) {
      const message = e?.message || 'Failed to close dispute';
      setError(message);
    } finally {
      setClosing(false);
    }
  };

  const handleSubmitEvidence = async () => {
    if (!selectedDispute) return;
    setSubmittingEvidence(true);
    setError(null);
    try {
      const evidence: any = {};
      if (evidenceEmail.trim()) {
        evidence.customer_email_address = evidenceEmail.trim();
      }
      if (evidenceName.trim()) {
        evidence.customer_name = evidenceName.trim();
      }
      if (evidenceIp.trim()) {
        evidence.customer_purchase_ip = evidenceIp.trim();
      }
      if (evidenceLog.trim()) {
        evidence.access_activity_log = evidenceLog.trim();
      }
      if (evidenceNotes.trim() || fraudType) {
        const prefix = fraudType ? `[fraud_type=${fraudType}] ` : '';
        evidence.uncategorized_text = prefix + evidenceNotes.trim();
      }
      if (Object.keys(evidence).length === 0) {
        setError('Please provide at least one evidence field before submitting.');
        setSubmittingEvidence(false);
        return;
      }
      await apiClient.post(`/api/subscription/disputes/${selectedDispute.id}`, { evidence });
      await loadDisputeDetails(selectedDispute.id);
    } catch (e: any) {
      const message = e?.message || 'Failed to submit evidence';
      setError(message);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const loadFraudWarnings = async () => {
    setFraudLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<FraudWarningListResponse>('/api/subscription/fraud-warnings', {
        params: { status: 'open', limit: 20 },
      });
      const list = response.data?.data;
      setFraudWarnings(Array.isArray(list) ? list : []);
    } catch (e: any) {
      const message = e?.message || 'Failed to load fraud warnings';
      setError(message);
    } finally {
      setFraudLoading(false);
    }
  };

  const loadFraudWarningDetails = async (id: string) => {
    setError(null);
    try {
      const response = await apiClient.get<FraudWarningResponse>(`/api/subscription/fraud-warnings/${id}`);
      if (response.data?.data) {
        setSelectedWarning(response.data.data);
      }
    } catch (e: any) {
      const message = e?.message || 'Failed to load fraud warning details';
      setError(message);
    }
  };

  const handleViewWarning = (id: string) => {
    loadFraudWarningDetails(id);
  };

  const handleRefundWarning = async () => {
    if (!selectedWarning) return;
    setRefundProcessing(true);
    setError(null);
    try {
      const body: any = {};
      if (actionNotes.trim()) {
        body.notes = actionNotes.trim();
      }
      await apiClient.post(`/api/subscription/fraud-warnings/${selectedWarning.id}/refund`, body);
      await loadFraudWarnings();
      await loadFraudWarningDetails(selectedWarning.id);
    } catch (e: any) {
      const message = e?.message || 'Failed to refund charge';
      setError(message);
    } finally {
      setRefundProcessing(false);
    }
  };

  const handleIgnoreWarning = async () => {
    if (!selectedWarning) return;
    setIgnoreProcessing(true);
    setError(null);
    try {
      const body: any = {};
      if (actionNotes.trim()) {
        body.notes = actionNotes.trim();
      }
      await apiClient.post(`/api/subscription/fraud-warnings/${selectedWarning.id}/ignore`, body);
      await loadFraudWarnings();
      await loadFraudWarningDetails(selectedWarning.id);
    } catch (e: any) {
      const message = e?.message || 'Failed to update fraud warning';
      setError(message);
    } finally {
      setIgnoreProcessing(false);
    }
  };

  useEffect(() => {
    loadDisputes();
  }, []);

  useEffect(() => {
    if (selectedDispute && selectedDispute.evidence) {
      const ev = selectedDispute.evidence;
      setEvidenceEmail(ev.customer_email_address || '');
      setEvidenceName(ev.customer_name || '');
      setEvidenceIp(ev.customer_purchase_ip || '');
      setEvidenceLog(ev.access_activity_log || '');
      if (ev.uncategorized_text) {
        setEvidenceNotes(ev.uncategorized_text);
      } else {
        setEvidenceNotes('');
      }
    } else {
      setEvidenceEmail('');
      setEvidenceName('');
      setEvidenceIp('');
      setEvidenceLog('');
      setEvidenceNotes('');
      setFraudType('');
    }
  }, [selectedDispute]);

  useEffect(() => {
    if (tab === 'fraudWarnings') {
      loadFraudWarnings();
    }
  }, [tab]);

  useEffect(() => {
    if (selectedWarning && selectedWarning.reason_notes) {
      setActionNotes(selectedWarning.reason_notes);
    } else {
      setActionNotes('');
    }
  }, [selectedWarning]);

  const formatAmount = (amount: number, currency: string) => {
    const value = amount / 100;
    const code = (currency || 'usd').toUpperCase();
    return `${value.toFixed(2)} ${code}`;
  };

  const formatDate = (unix: number) => {
    if (!unix) return '-';
    return new Date(unix * 1000).toLocaleString();
  };

  const formatIsoDate = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString();
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Stripe Disputes
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Internal dashboard for viewing and managing Stripe disputes. This view is intended for admins only.
      </Typography>

      <Box mt={2}>
        <Alert severity="info">
          Use this page to review Stripe disputes and submit clear evidence. For
          background on fraud patterns, see{' '}
          <a
            href="https://docs.stripe.com/disputes/prevention/fraud-types"
            target="_blank"
            rel="noreferrer"
          >
            Common types of online fraud
          </a>
          ,{' '}
          <a
            href="https://docs.stripe.com/disputes/prevention/card-testing"
            target="_blank"
            rel="noopener noreferrer"
          >
            Card testing
          </a>
          , and{' '}
          <a
            href="https://docs.stripe.com/disputes/prevention/identifying-fraud"
            target="_blank"
            rel="noopener noreferrer"
          >
            Identifying potential fraud
          </a>
          .
        </Alert>
      </Box>

      {error && (
        <Box mt={2}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      <Box mt={2}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
        >
          <Tab label="Disputes" value="disputes" />
          <Tab label="Fraud Warnings" value="fraudWarnings" />
        </Tabs>
      </Box>

      <Box mt={2} mb={2} display="flex" justifyContent="space-between" alignItems="center">
        {tab === 'disputes' ? (
          <Button variant="outlined" onClick={loadDisputes} disabled={loading}>
            Refresh disputes
          </Button>
        ) : (
          <Button variant="outlined" onClick={loadFraudWarnings} disabled={fraudLoading}>
            Refresh warnings
          </Button>
        )}
      </Box>

      {tab === 'disputes' ? (
        loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" mt={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Charge</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {disputes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No disputes found.
                    </TableCell>
                  </TableRow>
                )}
                {disputes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.id}</TableCell>
                    <TableCell>{formatAmount(d.amount, d.currency)}</TableCell>
                    <TableCell>{d.status}</TableCell>
                    <TableCell>{d.reason || '-'}</TableCell>
                    <TableCell>{d.charge || '-'}</TableCell>
                    <TableCell>{formatDate(d.created)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleViewDetails(d.id)}
                        sx={{ mr: 1 }}
                      >
                        Details
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleViewDetails(d.id)}
                      >
                        Close
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : fraudLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Charge</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fraudWarnings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No fraud warnings found.
                  </TableCell>
                </TableRow>
              )}
              {fraudWarnings.map((fw) => (
                <TableRow key={fw.id}>
                  <TableCell>{fw.id}</TableCell>
                  <TableCell>{fw.charge_id}</TableCell>
                  <TableCell>{formatAmount(fw.amount, fw.currency)}</TableCell>
                  <TableCell>{fw.status}</TableCell>
                  <TableCell>{fw.action}</TableCell>
                  <TableCell>{formatIsoDate(fw.created_at)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => handleViewWarning(fw.id)}
                    >
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={!!selectedDispute}
        onClose={() => setSelectedDispute(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Dispute Details</DialogTitle>
        <DialogContent dividers>
          {selectedDispute && (
            <Box>
              <Typography variant="subtitle2">ID</Typography>
              <Typography variant="body2" gutterBottom>{selectedDispute.id}</Typography>

              <Typography variant="subtitle2">Amount</Typography>
              <Typography variant="body2" gutterBottom>
                {formatAmount(selectedDispute.amount, selectedDispute.currency)}
              </Typography>

              <Typography variant="subtitle2">Status</Typography>
              <Typography variant="body2" gutterBottom>{selectedDispute.status}</Typography>

              <Typography variant="subtitle2">Reason</Typography>
              <Typography variant="body2" gutterBottom>{selectedDispute.reason || '-'}</Typography>

              <Typography variant="subtitle2">Charge</Typography>
              <Typography variant="body2" gutterBottom>{selectedDispute.charge || '-'}</Typography>

              <Typography variant="subtitle2">Created</Typography>
              <Typography variant="body2" gutterBottom>{formatDate(selectedDispute.created)}</Typography>

              <Box mt={2}>
                <Typography variant="subtitle2">Fraud Type</Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  margin="dense"
                  value={fraudType}
                  onChange={(e) => setFraudType(e.target.value)}
                  helperText="Choose the main fraud pattern: card testing, stolen card, overpayment, alternative refund, or other."
                >
                  <MenuItem value="">Not specified</MenuItem>
                  <MenuItem value="card_testing">Card testing</MenuItem>
                  <MenuItem value="stolen_card">Stolen card</MenuItem>
                  <MenuItem value="overpayment_fraud">Overpayment fraud</MenuItem>
                  <MenuItem value="alternative_refund">Alternative refund</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              </Box>

              <Box mt={1}>
                <Typography variant="subtitle2">Customer Email</Typography>
                <TextField
                  fullWidth
                  size="small"
                  margin="dense"
                  value={evidenceEmail}
                  onChange={(e) => setEvidenceEmail(e.target.value)}
                />
              </Box>

              <Box mt={1}>
                <Typography variant="subtitle2">Customer Name</Typography>
                <TextField
                  fullWidth
                  size="small"
                  margin="dense"
                  value={evidenceName}
                  onChange={(e) => setEvidenceName(e.target.value)}
                />
              </Box>

              <Box mt={1}>
                <Typography variant="subtitle2">Customer IP</Typography>
                <TextField
                  fullWidth
                  size="small"
                  margin="dense"
                  value={evidenceIp}
                  onChange={(e) => setEvidenceIp(e.target.value)}
                />
              </Box>

              <Box mt={1}>
                <Typography variant="subtitle2">Access Activity Log</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  margin="dense"
                  value={evidenceLog}
                  onChange={(e) => setEvidenceLog(e.target.value)}
                />
              </Box>

              <Box mt={1}>
                <Typography variant="subtitle2">Fraud Indicators / Notes</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  margin="dense"
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="Describe what looks suspicious: many failed attempts, overpayment + refund request, mismatched details, etc."
                  helperText="Summaries here should match patterns described in Stripe docs: card testing spikes, stolen card indicators, overpayment/alternative refund scams."
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedDispute(null)} disabled={closing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitEvidence}
            color="primary"
            variant="contained"
            disabled={submittingEvidence || closing}
          >
            {submittingEvidence ? 'Submitting...' : 'Submit Evidence'}
          </Button>
          <Button
            onClick={handleCloseDispute}
            color="error"
            variant="contained"
            disabled={closing}
          >
            {closing ? 'Closing...' : 'Close Dispute'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!selectedWarning}
        onClose={() => setSelectedWarning(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Fraud Warning Details</DialogTitle>
        <DialogContent dividers>
          {selectedWarning && (
            <Box>
              <Typography variant="subtitle2">ID</Typography>
              <Typography variant="body2" gutterBottom>{selectedWarning.id}</Typography>

              <Typography variant="subtitle2">Charge</Typography>
              <Typography variant="body2" gutterBottom>{selectedWarning.charge_id}</Typography>

              <Typography variant="subtitle2">Amount</Typography>
              <Typography variant="body2" gutterBottom>
                {formatAmount(selectedWarning.amount, selectedWarning.currency)}
              </Typography>

              <Typography variant="subtitle2">Status</Typography>
              <Typography variant="body2" gutterBottom>{selectedWarning.status}</Typography>

              <Typography variant="subtitle2">Action</Typography>
              <Typography variant="body2" gutterBottom>{selectedWarning.action}</Typography>

              <Typography variant="subtitle2">Created</Typography>
              <Typography variant="body2" gutterBottom>{formatIsoDate(selectedWarning.created_at)}</Typography>

              <Typography variant="subtitle2">Last Action At</Typography>
              <Typography variant="body2" gutterBottom>{formatIsoDate(selectedWarning.action_at)}</Typography>

              <Typography variant="subtitle2">Issuer Fraud Type</Typography>
              <Typography variant="body2" gutterBottom>
          {selectedWarning.meta_info?.early_fraud_warning?.fraud_type || '-'}
        </Typography>

        <Typography variant="subtitle2">Actionable</Typography>
        <Typography variant="body2" gutterBottom>
          {selectedWarning.meta_info?.early_fraud_warning?.actionable === true
            ? 'Yes'
            : selectedWarning.meta_info?.early_fraud_warning?.actionable === false
            ? 'No'
            : '-'}
        </Typography>

              <Box mt={2}>
                <Typography variant="subtitle2">Action Notes</Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  margin="dense"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSelectedWarning(null)}
            disabled={refundProcessing || ignoreProcessing}
          >
            Close
          </Button>
          <Button
            onClick={handleIgnoreWarning}
            disabled={ignoreProcessing || refundProcessing}
          >
            {ignoreProcessing ? 'Marking...' : 'Mark as Ignored'}
          </Button>
          <Button
            onClick={handleRefundWarning}
            color="error"
            variant="contained"
            disabled={refundProcessing || ignoreProcessing}
          >
            {refundProcessing ? 'Refunding...' : 'Refund Full Amount'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StripeDisputesDashboard;
