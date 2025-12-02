#!/bin/bash

# =============================================================================
# Let's Encrypt SSL Certificate Initialization Script
# =============================================================================
# This script initializes SSL certificates for your domain using Let's Encrypt
# 
# Usage: ./ssl/init-letsencrypt.sh
# 
# Prerequisites:
# 1. Domain must point to this server's IP address
# 2. Port 80 must be accessible for ACME challenge
#    - If port 80 is occupied, proxy /.well-known/acme-challenge/ 
#      from your existing app to this container on port 8080
# 3. Docker and Docker Compose must be installed
#
# Alternative: Use DNS challenge if you can't use port 80:
#   docker compose run --rm certbot certonly --manual --preferred-challenges dns -d yourdomain.com
# =============================================================================

set -e

# Configuration
domains=(example.com www.example.com)  # <-- Replace with your domain(s)
email=""                                # <-- Add your email for certificate expiry notifications
staging=0                               # Set to 1 for testing (avoids rate limits)
data_path="./certbot"
rsa_key_size=4096

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "  Let's Encrypt SSL Setup"
echo "=========================================="
echo ""

# Check if domain is configured
if [ "${domains[0]}" == "example.com" ]; then
    echo -e "${RED}Error: Please edit this script and set your domain(s)${NC}"
    echo ""
    echo "Open ssl/init-letsencrypt.sh and modify:"
    echo '  domains=(yourdomain.com www.yourdomain.com)'
    echo '  email="your-email@example.com"'
    echo ""
    exit 1
fi

# Check if email is set
if [ -z "$email" ]; then
    echo -e "${YELLOW}Warning: email is not set. You won't receive certificate expiry notifications.${NC}"
    email_arg=""
else
    email_arg="--email $email"
fi

# Create directories
echo -e "${GREEN}Creating certificate directories...${NC}"
mkdir -p "$data_path/conf"
mkdir -p "$data_path/www"

# Download recommended TLS parameters
if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
    echo -e "${GREEN}Downloading recommended TLS parameters...${NC}"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
fi

# Create dummy certificate for nginx to start
echo -e "${GREEN}Creating dummy certificate for ${domains[0]}...${NC}"
path="/etc/letsencrypt/live/${domains[0]}"
mkdir -p "$data_path/conf/live/${domains[0]}"
docker compose run --rm --entrypoint "\
    openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 \
      -keyout '$path/privkey.pem' \
      -out '$path/fullchain.pem' \
      -subj '/CN=localhost'" certbot

echo -e "${GREEN}Starting nginx...${NC}"
docker compose up --force-recreate -d nginx

echo -e "${GREEN}Deleting dummy certificate...${NC}"
docker compose run --rm --entrypoint "\
    rm -rf /etc/letsencrypt/live/${domains[0]} && \
    rm -rf /etc/letsencrypt/archive/${domains[0]} && \
    rm -rf /etc/letsencrypt/renewal/${domains[0]}.conf" certbot

echo -e "${GREEN}Requesting Let's Encrypt certificate for ${domains[*]}...${NC}"

# Build domain arguments
domain_args=""
for domain in "${domains[@]}"; do
    domain_args="$domain_args -d $domain"
done

# Select staging or production
if [ $staging != "0" ]; then
    staging_arg="--staging"
    echo -e "${YELLOW}Using STAGING environment (for testing)${NC}"
else
    staging_arg=""
fi

# Request certificate
docker compose run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
      $staging_arg \
      $email_arg \
      $domain_args \
      --rsa-key-size $rsa_key_size \
      --agree-tos \
      --force-renewal" certbot

echo ""
echo -e "${GREEN}=========================================="
echo "  SSL Certificate Successfully Obtained!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Update nginx/nginx.conf:"
echo "   - Uncomment the HTTPS server block"
echo "   - Replace YOUR_DOMAIN with: ${domains[0]}"
echo "   - Uncomment the HTTP to HTTPS redirect"
echo ""
echo "2. Or use the production config:"
echo "   cp nginx/nginx-ssl.conf nginx/nginx.conf"
echo "   (Edit and replace YOUR_DOMAIN with: ${domains[0]})"
echo ""
echo "3. Restart nginx:"
echo "   docker compose restart nginx"
echo ""
echo "Your site will be available at: https://${domains[0]}"
echo ""

