# =============================================================================
# Self-Signed SSL Certificate Generator (Windows PowerShell)
# =============================================================================
# Creates a self-signed SSL certificate for development or internal use.
# Browsers will show a security warning, but the connection is encrypted.
#
# Usage: .\ssl\generate-self-signed.ps1 [-Domain "yourdomain.com"]
# Example: .\ssl\generate-self-signed.ps1 -Domain "myapp.example.com"
# =============================================================================

param(
    [string]$Domain = "localhost"
)

$ErrorActionPreference = "Stop"

# Configuration
$CERT_DIR = "./certbot/conf/live/$Domain"
$DAYS_VALID = 365

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Self-Signed SSL Certificate Generator" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Domain: $Domain"
Write-Host "Valid for: $DAYS_VALID days"
Write-Host ""

# Create directories
New-Item -ItemType Directory -Force -Path $CERT_DIR | Out-Null

Write-Host "Generating private key..." -ForegroundColor Green
openssl genrsa -out "$CERT_DIR/privkey.pem" 2048

Write-Host "Generating certificate signing request..." -ForegroundColor Green
openssl req -new `
    -key "$CERT_DIR/privkey.pem" `
    -out "$CERT_DIR/cert.csr" `
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$Domain"

# Create SAN config file
$sanConfig = @"
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = $Domain

[v3_req]
subjectAltName = DNS:$Domain,DNS:www.$Domain,IP:127.0.0.1
"@
$sanConfig | Out-File -FilePath "$CERT_DIR/san.cnf" -Encoding ASCII

Write-Host "Generating self-signed certificate..." -ForegroundColor Green
openssl x509 -req `
    -days $DAYS_VALID `
    -in "$CERT_DIR/cert.csr" `
    -signkey "$CERT_DIR/privkey.pem" `
    -out "$CERT_DIR/fullchain.pem" `
    -extfile "$CERT_DIR/san.cnf" `
    -extensions v3_req

# Clean up temporary files
Remove-Item "$CERT_DIR/cert.csr" -ErrorAction SilentlyContinue
Remove-Item "$CERT_DIR/san.cnf" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Certificate Generated Successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Certificate location: $CERT_DIR/"
Write-Host "  - fullchain.pem (certificate)"
Write-Host "  - privkey.pem (private key)"
Write-Host ""
Write-Host "Note: This is a self-signed certificate." -ForegroundColor Yellow
Write-Host "Browsers will show a security warning." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:"
Write-Host ""
Write-Host "1. Update nginx/nginx-ssl.conf:"
Write-Host "   Replace YOUR_DOMAIN with: $Domain"
Write-Host ""
Write-Host "2. Copy to active config:"
Write-Host "   Copy-Item nginx\nginx-ssl.conf nginx\nginx.conf"
Write-Host ""
Write-Host "3. Restart nginx:"
Write-Host "   docker compose restart nginx"
Write-Host ""
Write-Host "Access your app at: https://${Domain}:8443"
Write-Host "(Accept the browser security warning)"
Write-Host ""

