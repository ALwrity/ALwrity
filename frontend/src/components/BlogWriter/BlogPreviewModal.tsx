import React from 'react';
import { Dialog, DialogContent, IconButton, Typography, Box, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';

interface BlogPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  introduction: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  convertMarkdownToHTML: (md: string) => string;
}

export const BlogPreviewModal: React.FC<BlogPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  introduction,
  sections,
  convertMarkdownToHTML,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        fullScreen
        sx={{
          '& .MuiDialog-paper': {
            bgcolor: '#fafbfc',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            bgcolor: 'white',
            borderBottom: '1px solid #e2e8f0',
            px: 3,
            py: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
            👁️ Blog Preview
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Print or Save as PDF">
              <IconButton onClick={handlePrint} sx={{ color: '#4f46e5' }}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Return to Editing">
              <IconButton onClick={onClose} sx={{ color: '#64748b' }}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Content */}
        <DialogContent
          sx={{
            px: { xs: 2, md: 4 },
            py: 4,
            maxWidth: '800px',
            mx: 'auto',
            bgcolor: 'white',
            borderRadius: 2,
            my: 2,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          {/* Blog Title */}
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontWeight: 800,
              color: '#1e293b',
              mb: 3,
              lineHeight: 1.2,
              fontFamily: 'Georgia, serif',
            }}
          >
            {title}
          </Typography>

          {/* Introduction */}
          {introduction && introduction.trim() && (
            <Box
              sx={{
                mb: 4,
                pb: 4,
                borderBottom: '2px solid #e5e7eb',
              }}
            >
              <div
                className="rendered-content-intro"
                dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(introduction) }}
              />
            </Box>
          )}

          {/* Sections */}
          {sections.map((section, index) => (
            <Box
              key={section.title || index}
              sx={{
                mb: 4,
                pb: 4,
                borderBottom: index < sections.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              {/* Section Title */}
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: '1.5rem', md: '1.75rem' },
                  fontWeight: 700,
                  color: '#1e293b',
                  mb: 2,
                  mt: 3,
                  fontFamily: 'Georgia, serif',
                  borderBottom: '1px solid #e5e7eb',
                  pb: 1,
                }}
              >
                {section.title}
              </Typography>

              {/* Section Content */}
              <div
                className="rendered-content"
                dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(section.content) }}
              />
            </Box>
          ))}
        </DialogContent>

        {/* Footer */}
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: 'white',
            borderTop: '1px solid #e2e8f0',
            px: 3,
            py: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.875rem' }}>
            {sections.length} sections &bull; Preview Mode
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
              Press Ctrl+P to print
            </Typography>
          </Box>
        </Box>
      </Dialog>

      {/* Rendered Content Styles + Print Styles */}
      <style>{`
        .rendered-content {
          font-family: Georgia, serif;
          font-size: 1rem;
          line-height: 1.8;
          color: #334155;
        }
        .rendered-content h1, .rendered-content h2, .rendered-content h3 {
          color: #111827;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .rendered-content h1 { font-size: 2rem; font-weight: 700; }
        .rendered-content h2 { font-size: 1.5rem; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
        .rendered-content h3 { font-size: 1.25rem; font-weight: 600; }
        .rendered-content h4 { font-size: 1.15rem; font-weight: 600; color: #1e293b; margin-top: 0.5rem; margin-bottom: 0.25rem; }
        .rendered-content h5, .rendered-content h6 { font-size: 1rem; font-weight: 600; color: #334155; margin-top: 0.5rem; margin-bottom: 0.25rem; }
        .rendered-content p { margin-bottom: 0.75rem; }
        .rendered-content strong { font-weight: 600; }
        .rendered-content em { font-style: italic; }
        .rendered-content a { color: #4f46e5; text-decoration: underline; }
        .rendered-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding: 0.5rem 1rem;
          margin: 0.75rem 0;
          color: #6b7280;
          font-style: italic;
          background: #f9fafb;
        }
        .rendered-content code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }
        .rendered-content kbd {
          background: #f1f5f9;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 1px 5px;
          font-family: monospace;
          font-size: 0.85em;
          box-shadow: 0 1px 0 #d1d5db;
        }
        .rendered-content mark { background: #fef3c7; color: #92400e; padding: 0 4px; border-radius: 2px; }
        .rendered-content sub, .rendered-content sup { font-size: 0.75em; line-height: 1; }
        .rendered-content details { margin-bottom: 0.75rem; }
        .rendered-content details summary { cursor: pointer; font-weight: 600; color: #1e293b; }
        .rendered-content details summary:hover { color: #4f46e5; }
        .rendered-content dl { margin-bottom: 0.75rem; }
        .rendered-content dl dt { font-weight: 600; color: #1e293b; margin-top: 0.5rem; }
        .rendered-content dl dd { margin-left: 1rem; color: #4b5563; }
        .rendered-content abbr { cursor: help; text-decoration: underline dotted #94a3b8; }
        .rendered-content ul, .rendered-content ol {
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .rendered-content li { margin-bottom: 0.25rem; }
        .rendered-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
        .rendered-content img { max-width: 100%; height: auto; border-radius: 8px; }

        .rendered-content .table-wrapper { overflow-x: auto; margin-bottom: 1rem; }
        .rendered-content .table-wrapper table { margin-bottom: 0; }

        .rendered-content table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }
        .rendered-content th, .rendered-content td {
          border: 1px solid #d1d5db;
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .rendered-content th { background: #f3f4f6; font-weight: 600; }
        .rendered-content tr:nth-of-type(even) { background: #f9fafb; }

        .rendered-content pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          font-family: monospace;
          font-size: 0.875rem;
          line-height: 1.5;
          margin: 1rem 0;
        }
        .rendered-content pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          font-size: inherit;
          line-height: inherit;
        }
        .rendered-content del { color: #991b1b; text-decoration: line-through; }
        .rendered-content input[type="checkbox"] { margin-right: 0.5rem; transform: scale(1.1); accent-color: #4f46e5; }

        .rendered-content-intro {
          font-family: Georgia, serif;
          font-size: 1.125rem;
          line-height: 1.8;
          color: #475569;
        }
        .rendered-content-intro .table-wrapper { overflow-x: auto; margin-bottom: 1rem; }
        .rendered-content-intro .table-wrapper table { margin-bottom: 0; }
        .rendered-content-intro table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1rem;
          font-size: 0.95rem;
        }
        .rendered-content-intro th, .rendered-content-intro td {
          border: 1px solid #d1d5db;
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .rendered-content-intro th { background: #f3f4f6; font-weight: 600; }
        .rendered-content-intro tr:nth-of-type(even) { background: #f9fafb; }
        .rendered-content-intro pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 0.875rem; line-height: 1.5; margin: 1rem 0; }
        .rendered-content-intro pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; line-height: inherit; }
        .rendered-content-intro code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .rendered-content-intro a { color: #4f46e5; text-decoration: underline; }
        .rendered-content-intro blockquote {
          border-left: 4px solid #e5e7eb;
          padding: 0.5rem 1rem;
          margin: 0.75rem 0;
          color: #6b7280;
          font-style: italic;
          background: #f9fafb;
        }
        .rendered-content-intro ul, .rendered-content-intro ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .rendered-content-intro li { margin-bottom: 0.25rem; }
        .rendered-content-intro img { max-width: 100%; height: auto; border-radius: 8px; }
        .rendered-content-intro del { color: #991b1b; text-decoration: line-through; }
        .rendered-content-intro input[type="checkbox"] { margin-right: 0.5rem; transform: scale(1.1); accent-color: #4f46e5; }
        .rendered-content-intro h1, .rendered-content-intro h2, .rendered-content-intro h3, .rendered-content-intro h4, .rendered-content-intro h5, .rendered-content-intro h6 { color: #111827; }

        @media print {
          body * { visibility: hidden; }
          .MuiDialogContent-root, .MuiDialogContent-root * { visibility: visible; }
          .MuiDialogContent-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 20px !important;
          }
          .MuiDialog-paper > div:first-child,
          .MuiDialog-paper > div:last-child { display: none !important; }
          h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
          img { max-width: 100% !important; page-break-inside: avoid; }
          pre, table { page-break-inside: avoid; }
        }
      `}</style>
    </>
  );
};

export default BlogPreviewModal;
