from functools import wraps
from flask import request, jsonify
import jwt
from datetime import datetime
from colorama import Fore, Style

class AuthMiddleware:
    def __init__(self, private_key_pem):
        self.private_key_pem = private_key_pem

    def log_auth(self, message: str, level: str = "info"):
        if level == "error":
            print(f"{Fore.RED}[AUTH DEBUG] ❌ {message}{Style.RESET_ALL}")
        elif level == "warning":
            print(f"{Fore.YELLOW}[AUTH DEBUG] ⚠️ {message}{Style.RESET_ALL}")
        elif level == "success":
            print(f"{Fore.GREEN}[AUTH DEBUG] ✅ {message}{Style.RESET_ALL}")
        else:
            print(f"{Fore.BLUE}[AUTH DEBUG] 🔍 {message}{Style.RESET_ALL}")

    def verify_token(self, token):
        try:
            self.log_auth(f"Attempting to verify token: {token[:20]}...")
            decoded = jwt.JWT().decode(token, jwt.jwk_from_pem(self.private_key_pem),  algorithms={"RS256"})
            self.log_auth(f"Token verified successfully for user: {decoded.get('login')}", "success")
            return decoded
        except Exception as e:
            self.log_auth(f"Token verification failed: {str(e)}", "error")
            return None

    def extract_token(self):
        # Log all headers for debugging
        self.log_auth("Request headers:")
        for header, value in request.headers.items():
            self.log_auth(f"  {header}: {value}")

        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            self.log_auth(f"Token extracted from Authorization header: {token[:20]}...", "success")
            return token

        cookie_token = request.cookies.get('Authorization')
        if cookie_token:
            self.log_auth(f"Token extracted from cookie: {cookie_token[:20]}...", "success")
            return cookie_token
        
        self.log_auth("No token found in Authorization header or cookies", "error")
        return None

    def get_token_data(self):
        token = self.extract_token()
        if not token:
            self.log_auth("No token available", "error")
            return None
        return self.verify_token(token)

    def require_auth(self, f):
        @wraps(f)
        def decorated(*args, **kwargs):
            self.log_auth(f"Checking authentication for route: {request.path}")
            token_data = self.get_token_data()
            
            if not token_data:
                self.log_auth("Authentication failed - no valid token data", "error")
                return jsonify({
                    "error": "Authentication required",
                    "message": "Valid authentication token is required"
                }), 401

            # Add token data to request context
            request.user = {
                "id": token_data.get("user_id"),
                "login": token_data.get("login"),
                "name": token_data.get("name"),
                "avatar_url": token_data.get("avatar_url")
            }
            # Store tokens separately for easy access
            request.oauth_token = token_data.get("oauth_token")
            request.installation_token = token_data.get("installation_token")
            
            self.log_auth(f"Authentication successful for user: {token_data.get('login')}", "success")
            return f(*args, **kwargs)
        return decorated

    def optional_auth(self, f):
        @wraps(f)
        def decorated(*args, **kwargs):
            self.log_auth(f"Checking optional authentication for route: {request.path}")
            token_data = self.get_token_data()
            
            if token_data:
                request.user = {
                    "id": token_data.get("user_id"),
                    "login": token_data.get("login"),
                    "name": token_data.get("name"),
                    "avatar_url": token_data.get("avatar_url")
                }
                # Store tokens separately for easy access
                request.oauth_token = token_data.get("oauth_token")
                request.installation_token = token_data.get("installation_token")
                self.log_auth(f"Optional authentication successful for user: {token_data.get('login')}", "success")
            else:
                request.user = None
                request.oauth_token = None
                request.installation_token = None
                self.log_auth("No authentication provided for optional route", "warning")
            
            return f(*args, **kwargs)
        return decorated 