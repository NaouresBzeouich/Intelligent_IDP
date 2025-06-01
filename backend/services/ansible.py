from jinja2 import Environment, FileSystemLoader
import os
from dotenv import load_dotenv

load_dotenv()
key_file=os.getenv("ANSIBLE_KEY_FILE")


# Set up Jinja2 environment to load templates from current dir
env = Environment(loader=FileSystemLoader(searchpath="./backend/templates/ansible"))

def create_ansible_files(output_dir, 
                         public_ip, 
                         docker_image_name, 
                         user,
                         docker_container_name="idp-container"
                         ):
    """
    Create Ansible deployment files from templates.
    
    Args:
        output_dir (str): Directory where the files will be created
        public_ip (str): Public IP of the target instance
        docker_image_name (str): Name of the Docker image to deploy
        docker_container_name (str): Name for the Docker container (default: idp-container)
    """
    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Generate inventory file
    inventory_template = env.get_template("inventory.ini.j2")
    inventory_output = inventory_template.render(
        user=user,
        key_file=key_file
    )
    
    inventory_path = os.path.join(output_dir, "inventory.ini")
    with open(inventory_path, "w") as fh:
        fh.write(inventory_output)
    print(f"Generated Ansible inventory file at {inventory_path}")

    docker_image = os.getenv("DOCKERHUB_USERNAME")+"/"+ docker_image_name

    # Generate deployment playbook
    deploy_template = env.get_template("deploy.yml.j2")
    deploy_output = deploy_template.render(
        docker_image_name=docker_image,
        docker_container_name=docker_container_name
    )
    
    deploy_path = os.path.join(output_dir, "deploy.yml")
    with open(deploy_path, "w") as fh:
        fh.write(deploy_output)
    print(f"Generated Ansible deployment file at {deploy_path}")


example_public_ip = "1.2.3.4"  
    
create_ansible_files(
    output_dir="ansible_clients/client1",
    public_ip=example_public_ip,
    docker_image_name="lesttest",
    user="azureuser")
