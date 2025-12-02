#!/bin/bash

# =============================================================================
# Self-Signed SSL Certificate Generator
# =============================================================================
# Creates a self-signed SSL certificate for development or internal use.
# Browsers will show a security warning, but the connection is encrypted.
#
# Usage: ./ssl/generate-self-signed.sh [domain]
# Example: ./ssl/generate-self-signed.sh myapp.example.com
# =============================================================================

set -e

# Configuration
DOMAIN="${1:-localhost}"
CERT_DIR="./certbot/conf/live/$DOMAIN"
DAYS_VALID=365

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  Self-Signed SSL Certificate Generator"
echo "=========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Valid for: $DAYS_VALID days"
echo ""

# Create directories
mkdir -p "$CERT_DIR"

echo -e "${GREEN}Generating private key...${NC}"
openssl genrsa -out "$CERT_DIR/privkey.pem" 2048

echo -e "${GREEN}Generating certificate signing request...${NC}"
openssl req -new \
    -key "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/cert.csr" \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

echo -e "${GREEN}Generating self-signed certificate...${NC}"
openssl x509 -req \
    -days $DAYS_VALID \
    -in "$CERT_DIR/cert.csr" \
    -signkey "$CERT_DIR/privkey.pem" \
    -out "$CERT_DIR/fullchain.pem" \
    -extfile <(printf "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN,IP:127.0.0.1")

# Clean up CSR
rm "$CERT_DIR/cert.csr"

echo ""
echo -e "${GREEN}=========================================="
echo "  Certificate Generated Successfully!"
echo "==========================================${NC}"
echo ""
echo "Certificate location: $CERT_DIR/"
echo "  - fullchain.pem (certificate)"
echo "  - privkey.pem (private key)"
echo ""
echo -e "${YELLOW}Note: This is a self-signed certificate.${NC}"
echo -e "${YELLOW}Browsers will show a security warning.${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Update nginx/nginx-ssl.conf:"
echo "   Replace YOUR_DOMAIN with: $DOMAIN"
echo ""
echo "2. Copy to active config:"
echo "   cp nginx/nginx-ssl.conf nginx/nginx.conf"
echo ""
echo "3. Restart nginx:"
echo "   docker compose restart nginx"
echo ""
echo "Access your app at: https://$DOMAIN:8443"
echo "(Accept the browser security warning)"
echo ""

