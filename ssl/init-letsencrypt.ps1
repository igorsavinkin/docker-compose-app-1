# =============================================================================
# Let's Encrypt SSL Certificate Initialization Script (Windows PowerShell)
# =============================================================================
# This script initializes SSL certificates for your domain using Let's Encrypt
# 
# Usage: .\ssl\init-letsencrypt.ps1
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

$ErrorActionPreference = "Stop"

# Configuration - EDIT THESE VALUES
$domains = @("example.com", "www.example.com")  # <-- Replace with your domain(s)
$email = ""                                       # <-- Add your email for certificate expiry notifications
$staging = $false                                 # Set to $true for testing (avoids rate limits)
$data_path = "./certbot"
$rsa_key_size = 4096

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Let's Encrypt SSL Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if domain is configured
if ($domains[0] -eq "example.com") {
    Write-Host "Error: Please edit this script and set your domain(s)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Open ssl/init-letsencrypt.ps1 and modify:"
    Write-Host '  $domains = @("yourdomain.com", "www.yourdomain.com")'
    Write-Host '  $email = "your-email@example.com"'
    Write-Host ""
    exit 1
}

# Check if email is set
if ([string]::IsNullOrEmpty($email)) {
    Write-Host "Warning: email is not set. You won't receive certificate expiry notifications." -ForegroundColor Yellow
    $email_arg = ""
} else {
    $email_arg = "--email $email"
}

# Create directories
Write-Host "Creating certificate directories..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path "$data_path/conf" | Out-Null
New-Item -ItemType Directory -Force -Path "$data_path/www" | Out-Null

# Download recommended TLS parameters
if (!(Test-Path "$data_path/conf/options-ssl-nginx.conf") -or !(Test-Path "$data_path/conf/ssl-dhparams.pem")) {
    Write-Host "Downloading recommended TLS parameters..." -ForegroundColor Green
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf" -OutFile "$data_path/conf/options-ssl-nginx.conf"
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem" -OutFile "$data_path/conf/ssl-dhparams.pem"
}

# Create dummy certificate for nginx to start
Write-Host "Creating dummy certificate for $($domains[0])..." -ForegroundColor Green
$path = "/etc/letsencrypt/live/$($domains[0])"
New-Item -ItemType Directory -Force -Path "$data_path/conf/live/$($domains[0])" | Out-Null

docker compose run --rm --entrypoint "openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 -keyout '$path/privkey.pem' -out '$path/fullchain.pem' -subj '/CN=localhost'" certbot

Write-Host "Starting nginx..." -ForegroundColor Green
docker compose up --force-recreate -d nginx

Write-Host "Deleting dummy certificate..." -ForegroundColor Green
docker compose run --rm --entrypoint "rm -rf /etc/letsencrypt/live/$($domains[0]) && rm -rf /etc/letsencrypt/archive/$($domains[0]) && rm -rf /etc/letsencrypt/renewal/$($domains[0]).conf" certbot

Write-Host "Requesting Let's Encrypt certificate for $($domains -join ', ')..." -ForegroundColor Green

# Build domain arguments
$domain_args = ($domains | ForEach-Object { "-d $_" }) -join " "

# Select staging or production
if ($staging) {
    $staging_arg = "--staging"
    Write-Host "Using STAGING environment (for testing)" -ForegroundColor Yellow
} else {
    $staging_arg = ""
}

# Request certificate
$certbot_cmd = "certbot certonly --webroot -w /var/www/certbot $staging_arg $email_arg $domain_args --rsa-key-size $rsa_key_size --agree-tos --force-renewal"
docker compose run --rm --entrypoint $certbot_cmd certbot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  SSL Certificate Successfully Obtained!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "1. Update nginx/nginx.conf:"
Write-Host "   - Uncomment the HTTPS server block"
Write-Host "   - Replace YOUR_DOMAIN with: $($domains[0])"
Write-Host "   - Uncomment the HTTP to HTTPS redirect"
Write-Host ""
Write-Host "2. Or use the production config:"
Write-Host "   Copy-Item nginx/nginx-ssl.conf nginx/nginx.conf"
Write-Host "   (Edit and replace YOUR_DOMAIN with: $($domains[0]))"
Write-Host ""
Write-Host "3. Restart nginx:"
Write-Host "   docker compose restart nginx"
Write-Host ""
Write-Host "Your site will be available at: https://$($domains[0])"
Write-Host ""

