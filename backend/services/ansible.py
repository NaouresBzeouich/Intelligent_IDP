from jinja2 import Environment, FileSystemLoader
import os
from dotenv import load_dotenv
import json

load_dotenv()
key_file=os.getenv("ANSIBLE_KEY_FILE")
dockerhub_uesername=os.getenv("DOCKERHUB_USERNAME")
env = Environment(loader=FileSystemLoader(searchpath="./backend/templates/ansible"))


def read_tf_output(output_dir):
    tf_output_path = os.path.join(output_dir, "tf_outputs.json")
    try:
        # Try UTF-16 first (handles ÿþ)
        with open(tf_output_path, 'r', encoding='utf-16') as f:
            return json.load(f)
    except UnicodeError:
        # Fallback to UTF-8 if UTF-16 fails
        with open(tf_output_path, 'r', encoding='utf-8') as f:
            return json.load(f)

def get_public_ip_user_type(output_dir):
    tf_data = read_tf_output(output_dir)
    if "instance_public_ip" in tf_data:
        return tf_data["instance_public_ip"]["value"] , "ubuntu"
    elif "azure_vm_public_ip" in tf_data:
        return tf_data["azure_vm_public_ip"]["value"] , "azureuser"
    else:
        return  "" , ""
    
def create_ansible_files(user_id,project_name,docker_image_name=None,public_ip=None,user_type=None):
    """
    if the project is on premise the public_ip and user_type NEED to be provided !!!!! 
    """
    
    output_dir=f"clients/{user_id}/{project_name}"
    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)

    if public_ip is None:
        public_ip, user_type = get_public_ip_user_type(output_dir)
    
    if docker_image_name is None:
        docker_image_name = project_name

    # Generate inventory file
    inventory_template = env.get_template("inventory.ini.j2")
    inventory_output = inventory_template.render(
        user=user_type,
        public_ip=public_ip,
    )
    
    inventory_path = os.path.join(output_dir, "inventory.ini")
    with open(inventory_path, "w") as fh:
        fh.write(inventory_output)
    print(f"Generated Ansible inventory file at {inventory_path}")

    docker_image = f"{dockerhub_uesername}/{docker_image_name}"

    # Generate deployment playbook
    deploy_template = env.get_template("deploy.yml.j2")
    deploy_output = deploy_template.render(
        docker_image_name=docker_image,
        docker_container_name=project_name
    )
    
    deploy_path = os.path.join(output_dir, "deploy.yml")
    with open(deploy_path, "w") as fh:
        fh.write(deploy_output)
    print(f"Generated Ansible deployment file at {deploy_path}")


# create_ansible_files(
    # user_id="client1",
    # project_name="project2",
    # docker_image_name="test1",
    # )