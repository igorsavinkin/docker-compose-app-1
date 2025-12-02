#!/bin/bash

# =============================================================================
# SSL Certificate Status Check Script
# =============================================================================
# Shows the current certificate status and expiration date.
#
# Usage: ./ssl/check-cert.sh
# =============================================================================

DOMAIN="webscraping.pro"
CERT_DIR="/var/www/httpd-cert"

echo ""
echo "=========================================="
echo "  SSL Certificate Status"
echo "=========================================="
echo ""

# Find certificates
echo "Available certificates for $DOMAIN:"
echo ""

for cert in "$CERT_DIR"/${DOMAIN}*.crt; do
    if [ -f "$cert" ]; then
        filename=$(basename "$cert")
        expiry=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)
        days_left=$(( ($(date -d "$expiry" +%s) - $(date +%s)) / 86400 ))
        
        if [ $days_left -lt 0 ]; then
            status="EXPIRED"
            color="\033[0;31m"
        elif [ $days_left -lt 14 ]; then
            status="EXPIRING SOON"
            color="\033[1;33m"
        else
            status="OK"
            color="\033[0;32m"
        fi
        
        echo -e "  $filename"
        echo -e "    Expires: $expiry"
        echo -e "    Days left: ${color}$days_left ($status)\033[0m"
        echo ""
    fi
done

# Check what's configured in docker-compose
echo "Currently configured in docker-compose.yml:"
grep -o "httpd-cert/[^:]*" ../docker-compose.yml 2>/dev/null | sed 's/^/  /' || echo "  Not configured"
echo ""

