-- Phase 96: CSV White-Label Support
-- Adds CSV header template and column labels configuration to client_branding

-- Add CSV header template column
-- Supports placeholders: {brand_name}, {report_type}
-- Default: "# {brand_name} {report_type} Report"
ALTER TABLE client_branding
ADD COLUMN IF NOT EXISTS csv_header_template TEXT;

-- Add CSV column labels (JSONB for flexible key-value mapping)
-- Allows agencies to customize column headers in exports
-- Example: {"keyword": "Search Term", "position": "Rank", "clicks": "Visits"}
ALTER TABLE client_branding
ADD COLUMN IF NOT EXISTS csv_column_labels JSONB;

-- Add comment for documentation
COMMENT ON COLUMN client_branding.csv_header_template IS 'Template for CSV header line. Placeholders: {brand_name}, {report_type}';
COMMENT ON COLUMN client_branding.csv_column_labels IS 'Custom column labels for CSV exports as JSON object';
