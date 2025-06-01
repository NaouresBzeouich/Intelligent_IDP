from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import os
import datetime
import time
import requests
import jwt
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

CLIENT_ID = "Iv23lisM1NexfziQUTe3"
CLIENT_SECRET = "7e1ebbb519925432abd377720b7a1c456edbb37a"
APP_ID = 1344769
PRIVATE_KEY_PATH = "idp-x.2025-05-30.private-key.pem"

# MongoDB Atlas configuration
MONGO_URI = "mongodb+srv://omar:ramo@cluster0.rt44zn0.mongodb.net/idpx"
DB_NAME = "idp_platform"

app = Flask(__name__)
# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:4200",
            "https://tidy-definitely-sailfish.ngrok-free.app"
        ],
        "methods": ["GET", "POST", "OPTIONS", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Initialize MongoDB client with connection pooling and timeout settings
try:
    mongo_client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,  # 5 second timeout
        connectTimeoutMS=10000,  # 10 second timeout
        maxPoolSize=50,  # Maximum number of connections
        retryWrites=True  # Enable retryable writes
    )
    # Verify connection
    mongo_client.admin.command('ping')
    print("Successfully connected to MongoDB Atlas")
    db = mongo_client[DB_NAME]
except (ConnectionFailure, ServerSelectionTimeoutError) as e:
    print(f"Failed to connect to MongoDB Atlas: {str(e)}")
    raise

client = Groq(api_key=("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"))

def create_jwt(app_id, private_key_pem):
    now = int(time.time())
    payload = {
        "iat": now,
        "exp": now + (580),
        "iss": app_id
    }
    return jwt.JWT().encode(payload, jwt.jwk_from_pem(private_key_pem), alg="RS256")

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

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    required_fields = ['repo_name', 'repo_full_name', 'repo_url', 'default_branch', 'installation_token', 'oauth_token']
    
    # Validate request data
    if not all(field in data for field in required_fields):
        return jsonify({
            "error": "Missing required fields",
            "required": required_fields
        }), 400

    try:
        # Check if project already exists
        existing_project = db.projects.find_one({
            "repo_full_name": data['repo_full_name'],
            "status": "active"
        })

        if existing_project:
            return jsonify({
                "error": "Project already exists",
                "project_id": str(existing_project['_id']),
                "repo_name": existing_project['repo_name']
            }), 409  # HTTP 409 Conflict

        # Verify repository access using installation token
        headers = {
            'Authorization': f'Bearer {data["oauth_token"]}',
            'Accept': 'application/vnd.github+json'
        }
        repo_check = requests.get(
            f'https://api.github.com/repos/{data["repo_full_name"]}',
            headers=headers
        )

        # if repo_check.status_code != 200:
        #     return jsonify({
        #         "error": "Failed to verify repository access",
        #         "details": repo_check.json()
        #     }), 400

        # Get user info for project ownership
        user_headers = {
            'Authorization': f'Bearer {data["oauth_token"]}',
            'Accept': 'application/vnd.github+json'
        }
        user_response = requests.get('https://api.github.com/user', headers=user_headers)
        if user_response.status_code != 200:
            return jsonify({
                "error": "Failed to get user information",
                "details": user_response.json()
            }), 400

        user_data = user_response.json()

        # Prepare project document with additional fields
        project = {
            'repo_name': data['repo_name'],
            'repo_full_name': data['repo_full_name'],
            'repo_url': data['repo_url'],
            'default_branch': data['default_branch'],
            'created_at': datetime.datetime.utcnow(),
            'updated_at': datetime.datetime.utcnow(),
            'status': 'active',
            'metadata': repo_check.json(),
            'settings': {
                'notifications': True,
                'auto_sync': True,
                'branch_protection': False
            },
            'owner': {
                'id': user_data['id'],
                'login': user_data['login'],
                'avatar_url': user_data['avatar_url']
            }
        }

        # Insert into MongoDB with write concern for durability
        result = db.projects.insert_one(project)

        return jsonify({
            "message": "Project created successfully",
            "project_id": str(result.inserted_id),
            "repo_name": data['repo_name']
        }), 201

    except requests.RequestException as e:
        return jsonify({
            "error": "GitHub API error",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "error": "Unexpected error",
            "details": str(e)
        }), 500

@app.route('/api/projects', methods=['GET'])
def list_projects():
    try:
        # Support pagination and filtering
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        search = request.args.get('search', '')
        
        # Build query - only show active projects
        query = {"status": "active"}
        if search:
            query["$or"] = [
                {"repo_name": {"$regex": search, "$options": "i"}},
                {"repo_full_name": {"$regex": search, "$options": "i"}}
            ]

        # Get total count for pagination
        total = db.projects.count_documents(query)
        
        # Get paginated projects
        projects = list(db.projects.find(
            query,
            {
                "repo_name": 1,
                "repo_full_name": 1,
                "repo_url": 1,
                "created_at": 1,
                "updated_at": 1,
                "default_branch": 1,
                "settings": 1
            }
        ).sort("created_at", -1)
         .skip((page - 1) * per_page)
         .limit(per_page))

        # Convert ObjectId and dates to string for JSON serialization
        for project in projects:
            project['_id'] = str(project['_id'])
            project['created_at'] = project['created_at'].isoformat()
            if 'updated_at' in project:
                project['updated_at'] = project['updated_at'].isoformat()

        return jsonify({
            "projects": projects,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch projects",
            "details": str(e)
        }), 500

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    try:
        # Get the GitHub token from the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "No authorization token provided"}), 401

        token = auth_header.split(' ')[1]

        # Get user info from GitHub
        headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github+json'
        }
        user_response = requests.get('https://api.github.com/user', headers=headers)
        if user_response.status_code != 200:
            return jsonify({
                "error": "Failed to verify user",
                "details": user_response.json()
            }), 401

        user_data = user_response.json()
        user_id = user_data['id']

        # Find the project and verify ownership
        project = db.projects.find_one({
            "_id": ObjectId(project_id),
            "status": "active"
        })

        if not project:
            return jsonify({
                "error": "Project not found"
            }), 404

        if project['owner']['id'] != user_id:
            return jsonify({
                "error": "Unauthorized to delete this project"
            }), 403

        # Soft delete by updating status
        result = db.projects.update_one(
            {"_id": ObjectId(project_id)},
            {
                "$set": {
                    "status": "deleted",
                    "deleted_at": datetime.datetime.utcnow(),
                    "deleted_by": user_id
                }
            }
        )

        if result.modified_count == 0:
            return jsonify({
                "error": "Failed to delete project"
            }), 500

        return jsonify({
            "message": "Project deleted successfully"
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to delete project",
            "details": str(e)
        }), 500

@app.route('/api/projects/sidebar', methods=['GET'])
def get_sidebar_projects():
    try:
        # Get the GitHub token from the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "No authorization token provided"}), 401

        token = auth_header.split(' ')[1]

        # Get user info from GitHub
        headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github+json'
        }
        user_response = requests.get('https://api.github.com/user', headers=headers)
        if user_response.status_code != 200:
            return jsonify({
                "error": "Failed to verify user",
                "details": user_response.json()
            }), 401

        user_data = user_response.json()
        user_id = user_data['id']

        # Get user's active projects only
        projects = list(db.projects.find(
            {
                "status": "active",
                "owner.id": user_id
            },
            {
                "repo_name": 1,
                "repo_full_name": 1,
                "repo_url": 1,
                "created_at": 1,
                "updated_at": 1,
                "description": 1,
                "metadata": 1
            }
        ).sort("created_at", -1))

        # Convert ObjectId and dates to string for JSON serialization
        for project in projects:
            project['_id'] = str(project['_id'])
            project['created_at'] = project['created_at'].isoformat()
            if 'updated_at' in project:
                project['updated_at'] = project['updated_at'].isoformat()
            # Extract description from metadata if not available at root level
            if not project.get('description') and project.get('metadata', {}).get('description'):
                project['description'] = project['metadata']['description']
            # Remove metadata from response to keep it clean
            project.pop('metadata', None)

        return jsonify({
            "projects": projects,
            "total": len(projects)
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch projects",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
