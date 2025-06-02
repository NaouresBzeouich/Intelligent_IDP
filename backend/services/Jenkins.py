import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv
import os
from jinja2 import Environment, FileSystemLoader

# === Load environment variables ===
load_dotenv()

jenkins_url = os.getenv("JENKINS_URL")
jenkins_api_token = os.getenv("JENKINS_API_TOKEN")
jenkins_user = os.getenv("JENKINS_USER")
dockerhub_username = os.getenv("DOCKERHUB_USERNAME")
dockerhub_password = os.getenv("DOCKERHUB_PASSWORD")
dockerhub_cred_Jenkins=os.getenv("DOCKERHUB_CREDS_FROM_JENKINS")

# === Jinja2 Template Render ===
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../templates/jenkins'))
env = Environment(loader=FileSystemLoader(template_dir))


import requests
from requests.auth import HTTPBasicAuth


def render_pipeline_script(public_repo_url, image_name, dockerhub_cred_Jenkins, user_id, branch="Main"):
    template = env.get_template('Jenkinsfile.j2')
    return template.render(
        public_repo_url=public_repo_url,
        image_name=image_name,
        dockerhub_cred_Jenkins=dockerhub_cred_Jenkins,
        user_id=user_id,
        branch=branch
    )

def render_job_config(pipeline_script):
    template = env.get_template('job_config.xml.j2')
    return template.render(
        description="Pipeline to build and push Docker image",
        pipeline_script=pipeline_script
    )

def create_jenkinsfile_jobConfig(user_id,repository_name,project_name=None,branch="Main"):
    if project_name is None:
        project_name = repository_name.split("/")[-1]
    
    output_dir=f"clients/{user_id}/{project_name}"
    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)

    pipeline_script = render_pipeline_script(
        repository_name,
        project_name,
        dockerhub_cred_Jenkins,
        user_id,
        branch
        )
    job_config = render_job_config(pipeline_script)
    
    pipeline_script_path = os.path.join(output_dir, "Jenkinsfile")
    with open(pipeline_script_path, "w") as fh:
        fh.write(pipeline_script)
    print(f"Generated Jenkinsfile at {pipeline_script_path}")

    job_config_path = os.path.join(output_dir, "job_config.xml")
    with open(job_config_path, "w") as fh:
        fh.write(job_config)
    print(f"Generated job_config.xml at {job_config_path}")


def get_jenkins_crumb():
    crumb_url = f"{jenkins_url}/crumbIssuer/api/json"
    response = requests.get(crumb_url, auth=HTTPBasicAuth(jenkins_user, jenkins_api_token))
    if response.status_code == 200:
        crumb_data = response.json()
        return {crumb_data['crumbRequestField']: crumb_data['crumb']}
    else:
        print(f"❌ Failed to get crumb: {response.status_code}")
        return None

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
    


# === Trigger build ===
def trigger_build(job_name):
    headers = get_jenkins_crumb()

    headers['Content-Type'] = 'application/xml'  # ou autre si besoin

    response = requests.post(
    f"{jenkins_url}/job/{job_name}/build",
    headers=headers,
    auth=HTTPBasicAuth(jenkins_user, jenkins_api_token)
    )

    if response.status_code == 201:
        print("✅ Build triggered successfully")
    else:
        print(f"❌ Failed to trigger build: {response.status_code}")
        print(response.text)


def create_jenkins_pipeline(user_id,  project_name ):
    input_dir=f"clients/{user_id}/{project_name}"
    # read the job_config.xml file
    with open(os.path.join(input_dir, "job_config.xml"), "r") as fh:
        job_config = fh.read()
    create_jenkins_job(project_name,job_config)
    trigger_build(project_name)


# create_jenkinsfile_jobConfig(
#     user_id="client112",
#     repository_name="https://github.com/mohamedazizbalti/Blog-Website",
#     branch="master",
#     project_name="viva"
# )
# create_jenkins_pipeline(
#     user_id="client112",
#     project_name="viva"
# )