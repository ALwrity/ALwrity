/**

 * LinkedIn Platform Card — Growth Engine social connection (Unipile OAuth).

 */



import React, { useEffect, useState } from 'react';

import {

  Avatar,

  Box,

  Card,

  Typography,

  Chip,

  CircularProgress,

  Tooltip,

  FormControl,

  InputLabel,

  Select,

  MenuItem,

  Button,

} from '@mui/material';

import {

  LinkedIn as LinkedInIcon,

  CheckCircle as CheckCircleIcon,

  Link as LinkIcon,

} from '@mui/icons-material';

import { useLinkedInSocialConnection } from '../../../hooks/useLinkedInSocialConnection';



interface LinkedInPlatformCardProps {

  connectedPlatforms: string[];

  setConnectedPlatforms: (platforms: string[]) => void;

  onConnect?: (platform: string) => void;

  onDisconnect?: (platform: string) => void;

}



const LinkedInPlatformCard: React.FC<LinkedInPlatformCardProps> = ({

  connectedPlatforms,

  setConnectedPlatforms,

  onConnect,

  onDisconnect,

}) => {

  const {

    connected,

    provider,

    hasPerUserToken,

    accountName,

    displayName,

    avatarUrl,

    primaryProfile,

    profileLoadWarning,

    accounts,

    organizations,

    selectedAccountId,

    selectedTarget,

    selectedOrgId,

    isLoading,

    isConnecting,

    connectError,

    connectWithOAuth,

    disconnect,

    handleAccountChange,

    handleTargetChange,

    handleOrgChange,

  } = useLinkedInSocialConnection();



  const [isDisconnecting, setIsDisconnecting] = useState(false);



  useEffect(() => {

    if (connected) {

      if (!connectedPlatforms.includes('linkedin')) {

        setConnectedPlatforms([...connectedPlatforms, 'linkedin']);

      }

    } else if (connectedPlatforms.includes('linkedin')) {

      setConnectedPlatforms(connectedPlatforms.filter((p) => p !== 'linkedin'));

    }

  }, [connected, connectedPlatforms, setConnectedPlatforms]);



  const showDisconnect = connected && hasPerUserToken;



  const handleLinkedInConnect = async () => {

    if (onConnect) {

      onConnect('linkedin');

    }

    await connectWithOAuth();

  };



  const handleLinkedInDisconnect = async () => {

    setIsDisconnecting(true);

    try {

      const success = await disconnect();

      if (success) {

        setConnectedPlatforms(connectedPlatforms.filter((p) => p !== 'linkedin'));

        onDisconnect?.('linkedin');

      }

    } finally {

      setIsDisconnecting(false);

    }

  };



  return (

    <Card

      variant="outlined"

      sx={{

        height: '100%',

        display: 'flex',

        flexDirection: 'column',

        p: 2,

        borderColor: connected ? '#2563EB' : '#CBD5E1',

        backgroundColor: connected ? '#DBEAFE' : '#EFF6FF',

        transition: 'all 0.2s ease',

        '&:hover': {

          borderColor: connected ? '#1D4ED8' : '#94A3B8',

          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',

        },

      }}

    >

      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>

        <Box display="flex" alignItems="center" gap={1.5}>

          <Box

            sx={{

              color: '#0A66C2',

              bgcolor: '#FFFFFF',

              p: 0.5,

              borderRadius: 1,

              border: '1px solid #CBD5E1',

              display: 'flex',

            }}

          >

            <LinkedInIcon fontSize="small" />

          </Box>

          <Box>

            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }}>

              LinkedIn

            </Typography>

            <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>

              Professional publishing

            </Typography>

          </Box>

        </Box>

        {isLoading ? (

          <CircularProgress size={16} sx={{ color: '#64748b' }} />

        ) : connected ? (

          <Tooltip title={`Connected via ${provider}`}>

            <CheckCircleIcon sx={{ color: '#3B82F6', fontSize: 20 }} />

          </Tooltip>

        ) : (

          <Chip label="Not connected" size="small" sx={{ height: 24, fontSize: '0.75rem', color: '#94A3B8', bgcolor: '#F1F5F9' }} />

        )}

      </Box>



      {connected ? (

        <Box mt={1} display="flex" flexDirection="column" gap={1.5}>

          <Box display="flex" alignItems="center" gap={1.5} mb={1}>

            {avatarUrl ? (

              <Avatar src={avatarUrl} alt={displayName} sx={{ width: 40, height: 40 }} />

            ) : (

              <Box

                sx={{

                  width: 40,

                  height: 40,

                  borderRadius: '50%',

                  bgcolor: '#0A66C2',

                  display: 'flex',

                  alignItems: 'center',

                  justifyContent: 'center',

                  color: '#fff',

                  fontSize: 16,

                  fontWeight: 700,

                }}

              >

                {(displayName || accountName || 'L')[0]}

              </Box>

            )}

            <Box>

              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}>

                {displayName || accountName || 'LinkedIn account'}

              </Typography>

              {primaryProfile?.accountTypeLabel && (

                <Typography variant="caption" sx={{ color: '#64748B' }}>

                  {primaryProfile.accountTypeLabel}

                </Typography>

              )}

            </Box>

          </Box>

          {profileLoadWarning && (

            <Typography variant="caption" sx={{ color: '#b91c1c', display: 'block', mb: 1 }}>

              {profileLoadWarning}

            </Typography>

          )}



          {accounts.length > 1 && (

            <FormControl size="small" fullWidth>

              <InputLabel id="linkedin-account-label">Account</InputLabel>

              <Select

                labelId="linkedin-account-label"

                label="Account"

                value={selectedAccountId}

                onChange={(e) => handleAccountChange(e.target.value)}

              >

                {accounts.map((account) => (

                  <MenuItem key={account.account_id} value={account.account_id}>

                    {account.username || account.account_id}

                    {account.account_type ? ` (${account.account_type})` : ''}

                  </MenuItem>

                ))}

              </Select>

            </FormControl>

          )}



          <FormControl size="small" fullWidth>

            <InputLabel id="linkedin-target-label">Post as</InputLabel>

            <Select

              labelId="linkedin-target-label"

              label="Post as"

              value={selectedTarget}

              onChange={(e) => handleTargetChange(e.target.value as 'profile' | 'organization')}

            >

              <MenuItem value="profile">Personal profile</MenuItem>

              <MenuItem value="organization">Company page</MenuItem>

            </Select>

          </FormControl>



          {selectedTarget === 'organization' && (

            <FormControl size="small" fullWidth>

              <InputLabel id="linkedin-org-label">Company page</InputLabel>

              <Select

                labelId="linkedin-org-label"

                label="Company page"

                value={selectedOrgId}

                onChange={(e) => handleOrgChange(e.target.value)}

              >

                {organizations.length === 0 ? (

                  <MenuItem value="" disabled>

                    No organizations found

                  </MenuItem>

                ) : (

                  organizations.map((org) => (

                    <MenuItem key={org.organization_id} value={org.organization_id}>

                      {org.name || org.organization_id}

                    </MenuItem>

                  ))

                )}

              </Select>

            </FormControl>

          )}



          {showDisconnect && (

            <Button

              size="small"

              color="error"

              variant="outlined"

              disabled={isDisconnecting}

              onClick={handleLinkedInDisconnect}

            >

              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}

            </Button>

          )}

        </Box>

      ) : (

        <Box mt={1} display="flex" flexDirection="column" gap={1}>

          <Typography variant="caption" sx={{ color: '#64748B', lineHeight: 1.45 }}>

            Sign in with LinkedIn in a popup. Choose your personal profile when asked to post as yourself and on company pages you manage.

          </Typography>

          <Button

            size="small"

            variant="contained"

            startIcon={isConnecting ? <CircularProgress size={14} color="inherit" /> : <LinkIcon />}

            disabled={isConnecting}

            onClick={handleLinkedInConnect}

            sx={{ bgcolor: '#0A66C2', '&:hover': { bgcolor: '#004182' }, alignSelf: 'flex-start' }}

          >

            Connect LinkedIn

          </Button>

          {connectError && (

            <Typography variant="caption" sx={{ color: '#b91c1c', lineHeight: 1.45 }} role="alert">

              {connectError}

            </Typography>

          )}

        </Box>

      )}

    </Card>

  );

};



export default LinkedInPlatformCard;
