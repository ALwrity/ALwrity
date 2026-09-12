/** LinkedIn-style onboarding dialog / popup surface (white card, soft shadow, readable text). */
export const onboardingDialogPaperProps = {
  sx: {
    borderRadius: 3,
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    border: '1px solid rgba(226, 232, 240, 0.8)',
    color: '#1e293b',
    backgroundImage: 'none',
    maxHeight: '85vh',
  },
};

export const onboardingDialogTitleSx = {
  pb: 1.5,
  bgcolor: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 1,
  pr: 1.5,
};

export const onboardingDialogContentSx = {
  pt: 2.5,
  pb: 3,
  bgcolor: '#ffffff',
  color: '#334155',
};
