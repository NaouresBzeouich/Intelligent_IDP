import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
import os
from jinja2 import Environment, FileSystemLoader

# === Load environment variables ===
load_dotenv()

jenkins_url = os.getenv("JENKINS_URL")
jenkins_api_token = os.getenv("JENKINS_PASSWORD")
jenkins_user = os.getenv("JENKINS_USER")
job_name = os.getenv("JOB_NAME")
dockerhub_username = os.getenv("DOCKERHUB_USERNAME")
dockerhub_password = os.getenv("DOCKERHUB_PASSWORD")
public_repo_url = os.getenv("PUBLIC_REPO_URL")

image_project_name = "test1"
image_name = f"{dockerhub_username}/{image_project_name}"


# === Jinja2 Template Render ===
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates/jenkins'))
env = Environment(loader=FileSystemLoader(template_dir))


import requests
from requests.auth import HTTPBasicAuth

def get_jenkins_crumb():
    crumb_url = f"{jenkins_url}/crumbIssuer/api/json"
    response = requests.get(crumb_url, auth=HTTPBasicAuth(jenkins_user, jenkins_api_token))
    if response.status_code == 200:
        crumb_data = response.json()
        return {crumb_data['crumbRequestField']: crumb_data['crumb']}
    else:
        print(f"❌ Failed to get crumb: {response.status_code}")
        return None


def render_pipeline_script():
    template = env.get_template('Jenkinsfile.j2')
    return template.render(
        public_repo_url=public_repo_url,
        image_name=image_name
    )

pipeline_script = render_pipeline_script()

def render_job_config(pipeline_script):
    template = env.get_template('job_config.xml.j2')
    return template.render(
        description="Pipeline to build and push Docker image",
        pipeline_script=pipeline_script
    )

job_config = render_job_config(pipeline_script)


# === Create job ===
def create_jenkins_job(job_name, job_config):
    headers = get_jenkins_crumb()

    if headers is None:
        exit("Crumb retrieval failed.")

    headers['Content-Type'] = 'application/xml'  # ou autre si besoin

    response = requests.post(
        f"{jenkins_url}/createItem?name={job_name}",
        data=job_config,
        headers=headers,
        auth=HTTPBasicAuth(jenkins_user, jenkins_api_token)
    )
    if response.status_code == 200:
        print("✅ Job created successfully")
    else:
        print(f"❌ Failed to create job: {response.status_code}")
        print(response.text)
    
    response = requests.post(
    f"{jenkins_url}/job/{job_name}/build",
    headers=headers,
    auth=HTTPBasicAuth(jenkins_user, jenkins_api_token)
)


# === Trigger build ===
def trigger_build(job_name):
    headers = get_jenkins_crumb()

    headers = {
        crumb_data['crumbRequestField']: crumb_data['crumb']
    }

    build_url = f"{jenkins_url}/job/{job_name}/build"
    response = requests.post(
        build_url,
        headers=headers,
        auth=HTTPBasicAuth(jenkins_user, jenkins_api_token)
    )

    if response.status_code == 201:
        print("✅ Build triggered successfully")
    else:
        print(f"❌ Failed to trigger build: {response.status_code}")
        print(response.text)


# === Execute all steps ===
create_jenkins_job(job_name,job_config)
trigger_build(job_name)
