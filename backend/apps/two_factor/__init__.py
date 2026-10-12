# Two-Factor Authentication (P8) — server-blind vault.
# The server stores only encrypted blobs + metadata; it never sees the
# master password, the derived key, or any TOTP secret in plaintext.