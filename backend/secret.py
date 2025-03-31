import secrets

# Generate a 256-bit secret key (32 bytes)
jwt_secret_key = secrets.token_urlsafe(32)  # URL-safe base64 encoded key
print("JWT Secret Key:", jwt_secret_key)