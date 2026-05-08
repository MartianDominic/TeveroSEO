/**
 * Export Menu Component
 * Phase 96-05: Client Portal
 *
 * Dropdown menu with CSV and Google Sheets export options.
 * Shows loading state during export.
 * Disabled if visibility.canExport = false.
 *
 * Design System v6: ghost-edge shadows, Geist font.
 */
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import { Button } from '@/client/components/ui/button';

interface ExportMenuProps {
  clientId: string;
  workspaceId: string;
  canExport: boolean;
  startDate?: string;
  endDate?: string;
  exportType?: 'queries' | 'pages' | 'summary';
  onExportStart?: () => void;
  onExportComplete?: (success: boolean, url?: string) => void;
}

export function ExportMenu({
  clientId,
  workspaceId,
  canExport,
  startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate = new Date().toISOString().split('T')[0],
  exportType = 'queries',
  onExportStart,
  onExportComplete,
}: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportingType, setExportingType] = useState<'csv' | 'sheets' | null>(null);

  const handleExport = async (type: 'csv' | 'sheets') => {
    if (!canExport || isExporting) return;

    setIsExporting(true);
    setExportingType(type);
    onExportStart?.();

    try {
      const endpoint =
        type === 'csv' ? '/api/analytics/export/csv' : '/api/analytics/export/sheets';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Workspace-ID': workspaceId,
      };

      // For Google Sheets, we might need OAuth token
      // In production, this would be stored in session or require re-auth
      if (type === 'sheets') {
        const oauthToken = await getGoogleOAuthToken();
        if (!oauthToken) {
          onExportComplete?.(false);
          return;
        }
        headers['X-Google-OAuth-Token'] = oauthToken;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientId,
          startDate,
          endDate,
          type: exportType,
        }),
      });

      if (type === 'csv' && response.ok) {
        // Download CSV file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${clientId}-${exportType}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onExportComplete?.(true);
      } else if (type === 'sheets' && response.ok) {
        const result = (await response.json()) as { data?: { spreadsheetUrl?: string } };
        if (result.data?.spreadsheetUrl) {
          window.open(result.data.spreadsheetUrl, '_blank');
          onExportComplete?.(true, result.data.spreadsheetUrl);
        } else {
          onExportComplete?.(false);
        }
      } else {
        onExportComplete?.(false);
      }
    } catch (error) {
      console.error('Export failed:', error);
      onExportComplete?.(false);
    } finally {
      setIsExporting(false);
      setExportingType(null);
    }
  };

  if (!canExport) {
    return (
      <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
        <DownloadIcon className="w-4 h-4 mr-2" />
        Export
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <>
              <LoadingSpinner className="w-4 h-4 mr-2" />
              Exporting...
            </>
          ) : (
            <>
              <DownloadIcon className="w-4 h-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <CsvIcon className="w-4 h-4 mr-2" />
          {exportingType === 'csv' ? 'Downloading...' : 'Download CSV'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('sheets')}
          disabled={isExporting}
          className="cursor-pointer"
        >
          <SheetsIcon className="w-4 h-4 mr-2" />
          {exportingType === 'sheets' ? 'Creating...' : 'Export to Google Sheets'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Placeholder for Google OAuth flow
// In production, this would trigger proper OAuth flow
async function getGoogleOAuthToken(): Promise<string | null> {
  // Check if we have a stored token
  const storedToken = sessionStorage.getItem('google_oauth_token');
  if (storedToken) {
    return storedToken;
  }

  // In production, redirect to OAuth flow
  // For now, return null to indicate auth needed
  console.warn('Google OAuth not implemented - would redirect to auth flow');
  return null;
}

// Icons
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7,10 12,15 17,10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CsvIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function SheetsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${className}`}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
