/**
 * LinkedInNavSection.tsx — UserBadge menu profile + writing voice blocks.
 */
import React from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';

import type { LinkedInPersonaSnapshot } from '../LinkedInWriter/utils/profileStrengthEvents';
import {
  userBadgeMenuEmailSx,
  userBadgeMenuIdentitySx,
  userBadgeMenuNameSx,
} from './userBadgeMenuStyles';

interface UserMenuIdentityHeaderProps {
  userName: string;
  userEmail?: string;
  headerActions: React.ReactNode;
}

/** Grey identity strip — name on same row as bell / refresh / plan. */
export const UserMenuIdentityHeader: React.FC<UserMenuIdentityHeaderProps> = ({
  userName,
  userEmail,
  headerActions,
}) => (
  <Box sx={userBadgeMenuIdentitySx} onClick={(e) => e.stopPropagation()}>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 0.75,
        minWidth: 0,
      }}
    >
      <Typography component="span" sx={userBadgeMenuNameSx}>
        {userName}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {headerActions}
      </Box>
    </Box>
    {userEmail && (
      <Typography variant="caption" sx={{ ...userBadgeMenuEmailSx, display: 'block', mt: 0, lineHeight: 1.05 }}>
        {userEmail}
      </Typography>
    )}
  </Box>
);

interface ActiveWritingVoiceSectionProps {
  personaSnapshot: LinkedInPersonaSnapshot | null;
  onClose: () => void;
}

/** Purple Active Writing Voice block (UserBadge menu) — original layout. */
export const ActiveWritingVoiceSection: React.FC<ActiveWritingVoiceSectionProps> = ({
  personaSnapshot,
  onClose,
}) => {
  if (!personaSnapshot) return null;

  return (
    <Box
      sx={{ px: 2.5, py: 1.25, bgcolor: '#faf5ff', borderBottom: '1px solid #e9d5ff' }}
      onClick={(e) => e.stopPropagation()}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: 12, lineHeight: 1 }} aria-hidden>
            ✍️
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Active Writing Voice
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={() => {
            onClose();
            window.dispatchEvent(new CustomEvent('linkedinwriter:openPreferences'));
          }}
          sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#7c3aed', textTransform: 'none', minWidth: 0, p: '2px 6px', '&:hover': { bgcolor: '#ede9fe' } }}
        >
          Adjust →
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: personaSnapshot.coreBelief || personaSnapshot.defaultTone ? 0.625 : 0 }}>
        <Chip
          label={personaSnapshot.personaName}
          size="small"
          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#7c3aed', color: '#ffffff', '& .MuiChip-label': { px: 1 } }}
        />
        {personaSnapshot.archetype && personaSnapshot.archetype !== personaSnapshot.personaName && (
          <Typography sx={{ fontSize: '0.68rem', color: '#6b7280' }}>
            · {personaSnapshot.archetype}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {personaSnapshot.defaultTone && (
          <Typography sx={{ fontSize: '0.68rem', color: '#374151' }}>
            <Box component="span" sx={{ fontWeight: 600 }}>Tone: </Box>
            {personaSnapshot.defaultTone.replace(/_/g, ' ')}
          </Typography>
        )}
        {personaSnapshot.coreBelief && (
          <Typography
            sx={{
              fontSize: '0.68rem', color: '#6b7280', fontStyle: 'italic',
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
            }}
          >
            "{personaSnapshot.coreBelief}"
          </Typography>
        )}
      </Box>
    </Box>
  );
};
