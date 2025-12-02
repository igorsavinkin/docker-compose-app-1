# SSL Certificates

Place your SSL certificate files here:

- `fullchain.pem` - Certificate + intermediate certificates
- `privkey.pem` - Private key

## For FastPanel Users

Copy certificates from your server:

```bash
# On your FastPanel server, find the certificate location:
ls -la /etc/letsencrypt/live/webscraping.pro/

# Copy to this folder:
cp /etc/letsencrypt/live/webscraping.pro/fullchain.pem ./ssl/certs/
cp /etc/letsencrypt/live/webscraping.pro/privkey.pem ./ssl/certs/
```

**Note:** After FastPanel renews certificates, you'll need to copy them again 
or mount the original location directly in docker-compose.yml.

