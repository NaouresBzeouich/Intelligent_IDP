from flask import Flask, request, jsonify, make_response, send_from_directory
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
from services.Jenkins import create_jenkinsfile_jobConfig, create_jenkins_pipeline
from services.ansible import create_ansible_files
from middleware.auth_middleware import AuthMiddleware
from colorama import init, Fore, Back, Style
import glob
from jinja2 import Environment, FileSystemLoader
from services.terraform import create_tf
import json

# Initialize colorama
init(autoreset=True)

def log_auth(message: str, level: str = "info"):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if level == "error":
        print(f"{Fore.RED}[{timestamp}] 🔒 AUTH ERROR: {message}{Style.RESET_ALL}")
    elif level == "warning":
        print(f"{Fore.YELLOW}[{timestamp}] ⚠️ AUTH WARNING: {message}{Style.RESET_ALL}")
    elif level == "success":
        print(f"{Fore.GREEN}[{timestamp}] ✅ AUTH SUCCESS: {message}{Style.RESET_ALL}")
    else:
        print(f"{Fore.BLUE}[{timestamp}] ℹ️ AUTH INFO: {message}{Style.RESET_ALL}")

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
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "expose_headers": ["Set-Cookie"]
    }
})

# Initialize MongoDB client
try:
    mongo_client = MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        maxPoolSize=50,
        retryWrites=True
    )
    mongo_client.admin.command('ping')
    print("Successfully connected to MongoDB Atlas")
    db = mongo_client[DB_NAME]
except (ConnectionFailure, ServerSelectionTimeoutError) as e:
    print(f"Failed to connect to MongoDB Atlas: {str(e)}")
    raise

client = Groq(api_key=("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"))

# Load the private key for JWT signing
with open(PRIVATE_KEY_PATH, "rb") as f:
    PRIVATE_KEY_PEM = f.read()

# Initialize auth middleware with PEM key
auth = AuthMiddleware(PRIVATE_KEY_PEM)

def create_jwt(app_id, private_key_pem):
    now = int(time.time())
    payload = {
        "iat": now,
        "exp": now + (580),
        "iss": app_id
    }
    return jwt.JWT().encode(payload, jwt.jwk_from_pem(private_key_pem), alg="RS256")
CLIENT_FOLDER = os.path.abspath('./clients')  # or './client' if same dir

@app.route('/clients/<path:path>')
def serve_client(path):
    return send_from_directory(CLIENT_FOLDER, path)

@app.route('/api/authorize', methods=['GET'])
def authorize():
    code = request.args.get('code')
    installation_id = request.args.get('installation_id')

    if not code or not installation_id:
        log_auth("Missing 'code' or 'installation_id' query parameter", "error")
        return jsonify({"error": "Missing 'code' or 'installation_id' query parameter"}), 400

    try:
        log_auth(f"Starting OAuth flow for installation_id: {installation_id}")
        
        # Exchange code for OAuth access token
        token_url = "https://github.com/login/oauth/access_token"
        headers = {"Accept": "application/json"}
        data = {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code,
        }
        token_resp = requests.post(token_url, headers=headers, data=data)
        if token_resp.status_code != 200:
            log_auth(f"Failed to get OAuth token: {token_resp.text}", "error")
            return jsonify({"error": "Failed to get OAuth token", "details": token_resp.text}), 400
        
        oauth_token = token_resp.json().get("access_token")
        if not oauth_token:
            log_auth("OAuth token not found in response", "error")
            return jsonify({"error": "OAuth token not found in response"}), 400

        log_auth("Successfully obtained OAuth token", "success")

        # Get GitHub user information
        user_headers = {
            'Authorization': f'Bearer {oauth_token}',
            'Accept': 'application/vnd.github+json'
        }
        user_response = requests.get('https://api.github.com/user', headers=user_headers)
        if user_response.status_code != 200:
            log_auth(f"Failed to get user information: {user_response.text}", "error")
            return jsonify({
                "error": "Failed to get user information",
                "details": user_response.json()
            }), 400

        user_data = user_response.json()
        log_auth(f"Retrieved user info for: {user_data.get('login')}", "success")

        # Create GitHub App JWT
        github_jwt = create_jwt(APP_ID, PRIVATE_KEY_PEM)
        log_auth("Created GitHub App JWT token", "success")

        # Request installation access token
        install_token_url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
        headers = {
            "Authorization": f"Bearer {github_jwt}",
            "Accept": "application/vnd.github+json",
        }
        install_resp = requests.post(install_token_url, headers=headers)
        if install_resp.status_code != 201:
            log_auth(f"Failed to get installation token: {install_resp.text}", "error")
            return jsonify({"error": "Failed to get installation token", "details": install_resp.text}), 400

        installation_token = install_resp.json().get("token")
        log_auth("Successfully obtained installation token", "success")

        # Create JWT payload with user info and tokens
        jwt_payload = {
            "user_id": user_data["id"],
            "login": user_data["login"],
            "name": user_data.get("name"),
            "avatar_url":  user_data["avatar_url"],
            "oauth_token":  oauth_token,
            "installation_token": installation_token,
        }

        # Create JWT token using the same PEM key
        auth_token = jwt.JWT().encode(jwt_payload, jwt.jwk_from_pem(PRIVATE_KEY_PEM), alg="RS256")
        log_auth(f"Created JWT token for user: {user_data['login']}", "success")

        # Create response with both JSON data and cookie
        response = make_response(jsonify({
            "token": auth_token,
            "user": {
                "id": user_data["id"],
                "login": user_data["login"],
                "name": user_data.get("name"),
                "avatar_url": user_data["avatar_url"]
            }
        }))

        # Set JWT token as HTTP-only cookie
        response.set_cookie(
            'Authorization',
            auth_token,
            httponly=True,
            secure=False,  # Set to True in production with HTTPS
            samesite='Lax',
            max_age=86400,  # 24 hours in seconds
            path='/'
        )
        log_auth(f"Set auth cookie for user: {user_data['login']}", "success")

        # Set CORS headers explicitly
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
        
        return response

    except Exception as e:
        log_auth(f"Authorization error: {str(e)}", "error")
        return jsonify({
            "error": "Authorization failed",
            "details": str(e)
        }), 500

# Update the existing auth check in other endpoints to use the new JWT token
def verify_jwt_token(token):
    try:
        decoded = jwt.JWT().decode(token, jwt.jwk_from_pem(PRIVATE_KEY_PEM), algorithms={"RS256"}, do_verify=True)
        log_auth(f"Successfully verified JWT token for user: {decoded.get('login')}", "success")
        return decoded
    except jwt.ExpiredSignatureError:
        log_auth("JWT token expired", "warning")
        return None
    except jwt.InvalidTokenError as e:
        log_auth(f"Invalid JWT token: {str(e)}", "error")
        return None

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

@app.route('/api/chat', methods=['GET'])
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

@app.route('/api/user/profile', methods=['GET'])
@auth.require_auth
def get_user_profile():
    try:
        return jsonify({
            "user": {
                "id": request.user["id"],
                "login": request.user["login"],
                "name": request.user["name"],
                "avatar_url": request.user["avatar_url"]
            }
        })
    except Exception as e:
        return jsonify({
            "error": "Failed to get user profile",
            "details": str(e)
        }), 500

@app.route('/api/repositories', methods=['GET'])
@auth.require_auth
def get_repositories():
    try:
        # Use the oauth_token from the request object
        headers = {
            'Authorization': f'Bearer {request.oauth_token}',
            'Accept': 'application/vnd.github+json'
        }
        
        # Get user's repositories
        response = requests.get(
            'https://api.github.com/user/repos',
            headers=headers,
            params={
                'sort': 'updated',
                'per_page': 100,
                'visibility': 'all'
            }
        )
        
        if response.status_code != 200:
            return jsonify({
                "error": "Failed to fetch repositories",
                "details": response.json()
            }), response.status_code

        repos = response.json()
        return jsonify({
            "repositories": repos,
            "total": len(repos)
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch repositories",
            "details": str(e)
        }), 500

@app.route('/api/projects', methods=['POST'])
@auth.require_auth
def create_project():
    data = request.json
    required_fields = ['repo_name', 'repo_full_name', 'repo_url', 'default_branch']
    
    if not all(field in data for field in required_fields):
        return jsonify({
            "error": "Missing required fields",
            "required": required_fields
        }), 400

    try:
        # Check if project already exists
        existing_project = db.projects.find_one({
            "repo_full_name": data['repo_full_name'],
            "user_id": request.user["id"],
            "status": "active"
        })

        if existing_project:
            return jsonify({
                "error": "Project already exists",
                "project_id": str(existing_project['_id']),
                "repo_name": existing_project['repo_name']
            }), 409

        # Verify repository access using oauth_token from request
        headers = {
            'Authorization': f'Bearer {request.oauth_token}',
            'Accept': 'application/vnd.github+json'
        }
        repo_check = requests.get(
            f'https://api.github.com/repos/{data["repo_full_name"]}',
            headers=headers
        )

        if repo_check.status_code != 200:
            return jsonify({
                "error": "Failed to verify repository access",
                "details": repo_check.json()
            }), 403

        # Prepare project document
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
                'id': request.user["id"],
                'login': request.user["login"],
                'avatar_url': request.user["avatar_url"]
            },
            'user_id': request.user["id"]
        }

        # Insert into MongoDB
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
@auth.require_auth
def list_projects():
    try:
        # Support pagination and filtering
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        search = request.args.get('search', '')
        
        # Build query - only show active projects for the authenticated user
        query = {
            "status": "active",
            "user_id": request.user["id"]
        }
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
@auth.require_auth
def delete_project(project_id):
    try:
        # Find the project and verify ownership
        project = db.projects.find_one({
            "_id": ObjectId(project_id),
            "status": "active"
        })

        if not project:
            return jsonify({
                "error": "Project not found"
            }), 404

        if project['owner']['id'] != request.user["id"]:
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
                    "deleted_by": request.user["id"]
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
@auth.require_auth
def get_sidebar_projects():
    try:
        # Get user's active projects only
        projects = list(db.projects.find(
            {
                "status": "active",
                "user_id": request.user["id"]
            },
            {
                "repo_name": 1,
                "repo_full_name": 1,
                "repo_url": 1,
                "created_at": 1,
                "updated_at": 1,
                "description": 1,
                "metadata": 1,
                "user_id": 1,  # Include user_id in projection
                "owner": 1     # Include owner object for additional user info
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
            "total": len(projects),
            "user_id": request.user["id"],  # Add authenticated user's ID
            "user": {                       # Add user info
                "id": request.user["id"],
                "login": request.user["login"],
                "name": request.user["name"],
                "avatar_url": request.user["avatar_url"]
            }
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch projects",
            "details": str(e)
        }), 500

@app.route('/api/github/<path:github_path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
@auth.require_auth
def github_proxy(github_path):
    try:
        # Build the GitHub API URL
        github_url = f'https://api.github.com/{github_path}'
        
        # Forward the request method and body
        method = request.method
        data = request.get_json(silent=True)
        params = request.args.to_dict()
        
        # Set up headers with OAuth token
        headers = {
            'Authorization': f'Bearer {request.oauth_token}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }

        # Forward the request to GitHub API
        response = requests.request(
            method=method,
            url=github_url,
            headers=headers,
            json=data if data else None,
            params=params
        )

        return response.json(), response.status_code

    except Exception as e:
        return jsonify({
            "error": "GitHub API request failed",
            "details": str(e)
        }), 500

@app.route('/api/repos', methods=['GET'])
@auth.require_auth
def get_user_repos():
    try:
        # Get query parameters
        sort = request.args.get('sort', 'updated')
        per_page = request.args.get('per_page', '100')
        visibility = request.args.get('visibility', 'all')

        # Make request to GitHub API using oauth_token
        headers = {
            'Authorization': f'Bearer {request.oauth_token}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }

        response = requests.get(
            'https://api.github.com/user/repos',
            headers=headers,
            params={
                'sort': sort,
                'per_page': per_page,
                'visibility': visibility
            }
        )

        if response.status_code != 200:
            return jsonify({
                "error": "Failed to fetch repositories",
                "details": response.json()
            }), response.status_code

        repos = response.json()
        
        # Transform the response if needed
        return jsonify({
            "repositories": repos,
            "total": len(repos)
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to fetch repositories",
            "details": str(e)
        }), 500

@app.route('/api/stacks', methods=['GET'])
@auth.require_auth
def get_stacks():
    try:
        # Define the path to docker templates directory
        templates_dir = './templates/docker'
        
        if not os.path.exists(templates_dir):
            return jsonify({
                'error': 'Docker templates directory not found',
                'details': f'Directory {templates_dir} does not exist'
            }), 404
            
        # Get all docker-compose and Dockerfile templates
        templates = []
        for ext in ['*.yml', '*.yaml', 'Dockerfile*','*.dockerfile','*.dockerfile.j2']:
            templates.extend(glob.glob(os.path.join(templates_dir, ext)))
        
        # Set up Jinja2 environment
        env = Environment(loader=FileSystemLoader('./templates/docker'))
        
        # Read and process each template
        stack_list = []
        for template_path in templates:
            try:
                template_name = os.path.basename(template_path)
                if template_name.endswith('.j2'):
                    # Process Jinja2 template
                    template = env.get_template(template_name)
                    content = template.render(envs='')  # Default empty string for envs
                else:
                    # Read regular file
                    with open(template_path, 'r') as f:
                        content = f.read()
                    
                # Get the filename without extension as the stack name
                name = os.path.splitext(os.path.basename(template_path))[0].split('.')[0]
                if name.lower() == 'dockerfile':
                    # For Dockerfile variants, include the full name
                    name = os.path.basename(template_path).split('.')[0]
                
                stack_list.append({
                    'name': name,
                    'content': content,
                    'file_path': os.path.basename(template_path)
                })
            except IOError as e:
                print(f"Error reading template {template_path}: {str(e)}")
                continue
                
        return jsonify({
            'stacks': stack_list,
            'total': len(stack_list)
        })
        
    except Exception as e:
        return jsonify({
            'error': 'Failed to fetch stack templates',
            'details': str(e)
        }), 500

@app.route('/api/stacks/render', methods=['POST'])
@auth.require_auth
def render_stack():
    try:
        data = request.get_json()
        template_name = data.get('template_name')
        env_vars = data.get('env_vars', {})
        
        if not template_name:
            return jsonify({
                'error': 'Template name is required',
                'details': 'Please provide a template_name in the request body'
            }), 400
            
        # Convert env_vars dict to Docker ENV format
        env_string = '\n'.join([f'ENV {key}="{value}"' for key, value in env_vars.items()]) or ''
        
        # Set up Jinja2 environment
        env = Environment(loader=FileSystemLoader('./templates/docker'))
        
        try:
            template = env.get_template(template_name)
            rendered_content = template.render(envs=env_string)
            
            return jsonify({
                'content': rendered_content
            })
            
        except Exception as e:
            return jsonify({
                'error': 'Failed to render template',
                'details': str(e)
            }), 500
            
    except Exception as e:
        return jsonify({
            'error': 'Failed to process request',
            'details': str(e)
        }), 500

def render_dockerfile(stack: str, env_vars: dict[str, str]) -> tuple[bool, str]:
    """
    Render a Dockerfile template with environment variables.
    
    Args:
        stack (str): Name of the stack/template to use (e.g., 'node', 'python')
        env_vars (dict[str, str]): Dictionary of environment variables
        
    Returns:
        tuple[bool, str]: (success, content/error)
        - success: True if template was rendered successfully, False otherwise
        - content: Rendered template content if successful, error message if failed
    """
    try:
        # Initialize Jinja2 environment
        env = Environment(loader=FileSystemLoader('./templates/docker'))
        
        # Get the template
        template_name = f"{stack}.dockerfile.j2"
        template = env.get_template(template_name)
        
        # Convert env_vars dict to Docker ENV format
        env_string = '\n'.join([f'ENV {key}="{value}"' for key, value in env_vars.items()]) or ''
        
        # Render the template
        dockerfile_content = template.render(envs=env_string)
        
        return True, dockerfile_content
        
    except Exception as e:
        return False, f"Failed to render Dockerfile template: {str(e)}"

def save_dockerfile(content: str, user_id: str, project_id: str) -> tuple[bool, str]:
    """
    Save Dockerfile content to client/userid/projectid/Dockerfile
    
    Args:
        content (str): Content of the Dockerfile
        user_id (str): User ID
        project_id (str): Project ID
        
    Returns:
        tuple[bool, str]: (success, message)
        - success: True if file was saved successfully, False otherwise
        - message: Success message or error description
    """
    try:
        # Create the directory path
        dir_path = os.path.join('clients', str(user_id), str(project_id))
        
        # Create directories if they don't exist
        os.makedirs(dir_path, exist_ok=True)
        
        # Full path for the Dockerfile
        dockerfile_path = os.path.join(dir_path, 'Dockerfile')
        
        # Write the content to the Dockerfile
        with open(dockerfile_path, 'w') as f:
            f.write(content)
            
        return True, f"Dockerfile saved successfully at {dockerfile_path}"
        
    except OSError as e:
        return False, f"Failed to create directory or save file: {str(e)}"
    except Exception as e:
        return False, f"Unexpected error while saving Dockerfile: {str(e)}"

@app.route('/api/projects/<project_id>/config', methods=['POST'])
@auth.require_auth
def save_project_config(project_id):
    try:
        # Get the configuration from request body
        config = request.json
        
        # Validate config structure
        required_fields = ['stack', 'envs', 'deploymentPlan']
        if not all(field in config for field in required_fields):
            return jsonify({
                "error": "Missing required fields in config",
                "required": required_fields
            }), 400

        # Find the project and verify ownership
        project = db.projects.find_one({
            "_id": ObjectId(project_id),
            "status": "active"
        })

        if not project:
            return jsonify({
                "error": "Project not found"
            }), 404

        if project['owner']['id'] != request.user["id"]:
            return jsonify({
                "error": "Unauthorized to modify this project"
            }), 403

        # Update project with new configuration
        result = db.projects.update_one(
            {"_id": ObjectId(project_id)},
            {
                "$set": {
                    "config": config,
                    "deployed": True,
                    "updated_at": datetime.datetime.utcnow()
                }
            }
        )

        if result.modified_count == 0:
            return jsonify({
                "error": "Failed to update project configuration"
            }), 500

        # Save Dockerfile if stack is provided
        if config.get('stack'):
            # Render the Dockerfile
            success, content = render_dockerfile(config['stack'], config['envs'])
            if not success:
                print(f"Warning: {content}")
            else:
                # Save the Dockerfile
                save_success, save_message = save_dockerfile(
                    content=content,
                    user_id=request.user["id"],
                    project_id=project_id
                )
                
                if not save_success:
                    print(f"Warning: Failed to save Dockerfile: {save_message}")
        # create terraform files
        create_tf(
            type=config['deploymentPlan'],
            user_id=request.user["id"],
            project_name=project_id
        )
        
        # create_ansible_files(
        #     user_id=request.user["id"],
        #     project_name=project_id,
        #     docker_image_name=project_id,
            
        #     )
        # get from database the project by id

        # Get the updated project
        updated_project = db.projects.find_one({"_id": ObjectId(project_id)})
        updated_project['_id'] = str(updated_project['_id'])
        updated_project['created_at'] = updated_project['created_at'].isoformat()
        if 'updated_at' in updated_project:
            updated_project['updated_at'] = updated_project['updated_at'].isoformat()
        create_jenkinsfile_jobConfig(
            user_id=request.user["id"],
            project_name=project_id,
            branch=updated_project["default_branch"],
            repository_name=updated_project["repo_url"]
        )
        return jsonify(updated_project)

    except Exception as e:
        return jsonify({
            "error": "Failed to save project configuration",
            "details": str(e)
        }), 500

@app.route('/api/projects/<project_id>/launch', methods=['POST'])
@auth.require_auth
def launch_jenkins_job(project_id):
    try:
        # Find the project and verify ownership
        project = db.projects.find_one({
            "_id": ObjectId(project_id),
            "status": "active"
        })

        if not project:
            return jsonify({
                "error": "Project not found"
            }), 404

        if project['owner']['id'] != request.user["id"]:
            return jsonify({
                "error": "Unauthorized to launch this project"
            }), 403

        # Create and trigger Jenkins pipeline
        create_jenkins_pipeline(
            user_id=request.user["id"],
            project_name=project_id
        )

        return jsonify({
            "message": "Jenkins pipeline created and triggered successfully",
            "project_id": project_id
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to launch Jenkins pipeline",
            "details": str(e)
        }), 500

@app.route('/api/terraform/state/<project_id>', methods=['GET'])
def get_terraform_state(project_id):
    try:
        # Get project to find the user_id
        project = db.projects.find_one({
            "_id": ObjectId(project_id),
            "status": "active"
        })

        if not project:
            return jsonify({
                "error": "Project not found"
            }), 404

        # Define the state file path using project's user_id
        state_dir = os.path.join('clients', str(project['user_id']), str(project_id))
        state_file = os.path.join(state_dir, 'terraform.tfstate')

        # If state file doesn't exist, return empty state
        if not os.path.exists(state_file):
            return jsonify({
                "version": 4,
                "terraform_version": "1.0.0",
                "serial": 1,
                "lineage": "",
                "outputs": {},
                "resources": []
            })

        # Read and return the state file
        with open(state_file, 'r') as f:
            state_data = json.loads(f.read())
            return jsonify(state_data)

    except Exception as e:
        return jsonify({
            "error": "Failed to get Terraform state",
            "details": str(e)
        }), 500

@app.route('/api/terraform/state/<project_id>', methods=['POST'])
def update_terraform_state(project_id):
    try:
        # Get project to find the user_id
        project = db.projects.find_one({
            "_id": ObjectId(project_id),
            "status": "active"
        })

        if not project:
            return jsonify({
                "error": "Project not found"
            }), 404

        # Get the state data from request
        state_data = request.get_json()
        
        if not state_data:
            return jsonify({
                "error": "No state data provided"
            }), 400

        # Define the state file path using project's user_id
        state_dir = os.path.join('clients', str(project['user_id']), str(project_id))
        state_file = os.path.join(state_dir, 'terraform.tfstate')

        # Create directory if it doesn't exist
        os.makedirs(state_dir, exist_ok=True)

        # Write the state file
        with open(state_file, 'w') as f:
            json.dump(state_data, f, indent=2)

        return jsonify({
            "message": "State updated successfully"
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to update Terraform state",
            "details": str(e)
        }), 500

@app.route('/api/terraform/state/<project_id>/lock', methods=['POST'])
def lock_terraform_state(project_id):
    try:
        # Get project to find the user_id
        project = db.projects.find_one({
            "_id": ObjectId(project_id),
            "status": "active"
        })

        if not project:
            return jsonify({
                "error": "Project not found"
            }), 404

        lock_info = request.get_json()
        
        if not lock_info:
            return jsonify({
                "error": "No lock info provided"
            }), 400

        # Define the lock file path using project's user_id
        state_dir = os.path.join('clients', str(project['user_id']), str(project_id))
        lock_file = os.path.join(state_dir, '.terraform.tfstate.lock')

        # Create directory if it doesn't exist
        os.makedirs(state_dir, exist_ok=True)

        # Check if lock file exists
        if os.path.exists(lock_file):
            with open(lock_file, 'r') as f:
                existing_lock = json.loads(f.read())
                return jsonify(existing_lock), 423  # Locked status code

        # Write the lock file
        with open(lock_file, 'w') as f:
            lock_info['locked_at'] = datetime.datetime.utcnow().isoformat()
            json.dump(lock_info, f, indent=2)

        return jsonify({
            "message": "Lock acquired successfully"
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to lock Terraform state",
            "details": str(e)
        }), 500

@app.route('/api/terraform/state/<project_id>/unlock', methods=['DELETE'])
def unlock_terraform_state(project_id):
    try:
        # Get project to find the user_id
        project = db.projects.find_one({
            "_id": ObjectId(project_id),
            "status": "active"
        })

        if not project:
            return jsonify({
                "error": "Project not found"
            }), 404

        # Define the lock file path using project's user_id
        state_dir = os.path.join('clients', str(project['user_id']), str(project_id))
        lock_file = os.path.join(state_dir, '.terraform.tfstate.lock')

        # Remove the lock file if it exists
        if os.path.exists(lock_file):
            os.remove(lock_file)

        return jsonify({
            "message": "Lock released successfully"
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to unlock Terraform state",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
