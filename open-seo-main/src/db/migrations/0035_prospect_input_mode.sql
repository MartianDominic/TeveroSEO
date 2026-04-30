-- Phase 56: Prospect Input Excellence
-- Add multi-modal input columns to prospects table

ALTER TABLE prospects ADD COLUMN input_mode TEXT;
ALTER TABLE prospects ADD COLUMN raw_input TEXT;
ALTER TABLE prospects ADD COLUMN extracted_data JSONB;
ALTER TABLE prospects ADD COLUMN confirmed_data JSONB;
ALTER TABLE prospects ADD COLUMN confirmation_status TEXT;

-- Add check constraints for enum validation
ALTER TABLE prospects ADD CONSTRAINT chk_input_mode_valid
  CHECK (input_mode IS NULL OR input_mode IN ('website', 'website_with_context', 'conversation'));

ALTER TABLE prospects ADD CONSTRAINT chk_confirmation_status_valid
  CHECK (confirmation_status IS NULL OR confirmation_status IN ('pending', 'confirmed', 'skipped'));

-- Add comment for documentation
COMMENT ON COLUMN prospects.input_mode IS 'How prospect was created: website (URL only), website_with_context (URL + notes), or conversation (transcript only)';
COMMENT ON COLUMN prospects.raw_input IS 'Original conversation transcript or context notes (up to 50KB)';
COMMENT ON COLUMN prospects.extracted_data IS 'AI-extracted business information before user confirmation';
COMMENT ON COLUMN prospects.confirmed_data IS 'User-verified extraction with confirmation metadata';
COMMENT ON COLUMN prospects.confirmation_status IS 'Whether user has confirmed AI extraction: pending, confirmed, or skipped';
