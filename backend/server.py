from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import os
import datetime
import time
import requests
import jwt
import time

CLIENT_ID = "Iv23lisM1NexfziQUTe3"
CLIENT_SECRET = "7e1ebbb519925432abd377720b7a1c456edbb37a"
APP_ID = 1344769 # integer as string or int
PRIVATE_KEY_PATH = "idp-x.2025-05-30.private-key.pem"

app = Flask(__name__)
CORS(app)

client = Groq(api_key=("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"))

def create_jwt(app_id, private_key_pem):
    now = int(time.time())
    payload = {
        "iat": now,
        "exp": now + (580),  # 10 minutes max
        "iss": app_id
    }
    return jwt.JWT().encode(payload, jwt.jwk_from_pem(private_key_pem)  , alg="RS256")


@app.route('/authorize', methods=['GET'])
def authorize():
    code = request.args.get('code')
    installation_id = request.args.get('installation_id')

    if not code or not installation_id:
        return jsonify({"error": "Missing 'code' or 'installation_id' query parameter"}), 400

    # 1. Exchange code for OAuth access token
    token_url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
    }
    token_resp = requests.post(token_url, headers=headers, data=data)
    if token_resp.status_code != 200:
        return jsonify({"error": "Failed to get OAuth token", "details": token_resp.text}), 400
    print("Token response:", token_resp.json())
    oauth_token = token_resp.json().get("access_token")

    if not oauth_token:
        return jsonify({"error": "OAuth token not found in response"}), 400

    # 2. Load private key and create JWT
    with open(PRIVATE_KEY_PATH, "rb") as f:
        private_key_pem = f.read()

    jwt_token = create_jwt(APP_ID, private_key_pem)

    # 3. Request installation access token
    install_token_url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github+json",
    }
    install_resp = requests.post(install_token_url, headers=headers)
    if install_resp.status_code != 201:
        return jsonify({"error": "Failed to get installation token", "details": install_resp.text}), 400

    installation_token = install_resp.json().get("token")

    # Return both tokens
    return jsonify({
        "oauth_token": oauth_token,
        "installation_token": installation_token
    })




@app.before_request
def log_request_info():
    arrival_time = datetime.datetime.utcnow().isoformat() + "Z"
    method = request.method
    path = request.path
    try:
        body = request.get_json(force=True, silent=True)
    except Exception:
        body = None
    print(f"[{arrival_time}] {method} {path} - Body: {body}")

@app.route('/webhook', methods=['POST'])
def github_webhook():
    payload = request.form.get("payload")
    print("Received webhook payload:")
    print(payload)
    return jsonify({"status": "received"}), 200


@app.route('/chat', methods=['GET'])
def chat():
    user_message = request.args["message"]
    # user_message = data.get("message", "")

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "in the context of my internal development platform i want some recommendations "
                        "to the architectures i should choose between on prem, azure, aws, which tech stack should i choose.. kubernetes is no option "
                        "for prem ignore the buying, suppose the servers are already there, ignore the maintenance costs. "
                        "the expected response should be a strict final decision at the begginging of the answer, followed by explainations, "
                    )
                },
                {
                    "role": "user",
                    "content": user_message
                }
            ],
            model="llama-3.3-70b-versatile",
            stream=False,
        )
        reply = chat_completion.choices[0].message.content
        return jsonify({"response": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
