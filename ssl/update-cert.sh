#!/bin/bash

# =============================================================================
# FastPanel SSL Certificate Auto-Update Script
# =============================================================================
# Automatically finds the latest SSL certificate from FastPanel and updates
# docker-compose.yml, then restarts nginx.
#
# Usage: ./ssl/update-cert.sh
# 
# Add to crontab for automatic updates:
#   0 3 * * * /path/to/node-app-db2/ssl/update-cert.sh >> /var/log/cert-update.log 2>&1
# =============================================================================

set -e

# Configuration
DOMAIN="webscraping.pro"
CERT_DIR="/var/www/httpd-cert"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  FastPanel Certificate Update"
echo "=========================================="
echo "$(date)"
echo ""

# Find the latest certificate and key files
echo -e "${GREEN}Looking for certificates in $CERT_DIR...${NC}"

CERT_FILE=$(ls -t "$CERT_DIR"/${DOMAIN}*.crt 2>/dev/null | head -1)
KEY_FILE=$(ls -t "$CERT_DIR"/${DOMAIN}*.key 2>/dev/null | head -1)

if [ -z "$CERT_FILE" ] || [ -z "$KEY_FILE" ]; then
    echo -e "${RED}Error: Certificate files not found for $DOMAIN${NC}"
    echo "Looking in: $CERT_DIR"
    echo "Expected pattern: ${DOMAIN}*.crt and ${DOMAIN}*.key"
    exit 1
fi

echo "Found certificate: $CERT_FILE"
echo "Found key: $KEY_FILE"

# Check if files are readable
if [ ! -r "$CERT_FILE" ]; then
    echo -e "${RED}Error: Cannot read certificate file. Try running with sudo.${NC}"
    exit 1
fi

# Backup current docker-compose.yml
cp "$COMPOSE_FILE" "$COMPOSE_FILE.backup"

# Update docker-compose.yml with new certificate paths
echo -e "${GREEN}Updating docker-compose.yml...${NC}"

# Use sed to replace the certificate paths
sed -i "s|/var/www/httpd-cert/${DOMAIN}.*\.crt:|${CERT_FILE}:|g" "$COMPOSE_FILE"
sed -i "s|/var/www/httpd-cert/${DOMAIN}.*\.key:|${KEY_FILE}:|g" "$COMPOSE_FILE"

# Verify the update
if grep -q "$CERT_FILE" "$COMPOSE_FILE"; then
    echo -e "${GREEN}docker-compose.yml updated successfully${NC}"
else
    echo -e "${RED}Error: Failed to update docker-compose.yml${NC}"
    echo "Restoring backup..."
    mv "$COMPOSE_FILE.backup" "$COMPOSE_FILE"
    exit 1
fi

# Remove backup on success
rm "$COMPOSE_FILE.backup"

# Restart nginx to pick up new certificate
echo -e "${GREEN}Restarting nginx...${NC}"
cd "$PROJECT_DIR"

if docker compose ps | grep -q "nginx"; then
    docker compose restart nginx
    echo -e "${GREEN}Nginx restarted successfully${NC}"
else
    echo -e "${YELLOW}Nginx container not running. Start with: docker compose up -d${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "  Certificate Update Complete!"
echo "==========================================${NC}"
echo ""
echo "Certificate: $(basename "$CERT_FILE")"
echo "Valid until: $(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2 || echo "Unable to read")"
echo ""

