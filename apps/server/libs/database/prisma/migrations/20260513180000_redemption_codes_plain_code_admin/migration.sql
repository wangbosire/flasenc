-- Persist plaintext redemption code for admin content list (C-side copy); redeem flow still uses code_hash only.
ALTER TABLE `redemption_codes` ADD COLUMN `plain_code` VARCHAR(128) NULL AFTER `code_hash`;
