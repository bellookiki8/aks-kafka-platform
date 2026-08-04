\# Kafka on AKS



Kafka runs on the cluster as a self-hosted Helm release. It is installed with a

single command rather than through Terraform, because the Bitnami chart does not

re-render cleanly under the Terraform Helm provider after Bitnami's 2025 move to

a legacy image catalog. Installing it directly with Helm is reliable and keeps

the setup fully reproducible.



\## Prerequisites



The AKS cluster and ACR must already exist (see `../infra`), and kubectl must be

pointed at the cluster:



&#x20;   az aks get-credentials --resource-group rg-kafkaplatform-dev --name aks-kafkaplatform-dev --overwrite-existing



\## Install



&#x20;   helm repo add bitnami https://charts.bitnami.com/bitnami

&#x20;   helm repo update



&#x20;   helm install kafka bitnami/kafka \\

&#x20;     --namespace kafka \\

&#x20;     --create-namespace \\

&#x20;     --set global.imageRegistry=docker.io \\

&#x20;     --set image.repository=bitnamilegacy/kafka \\

&#x20;     --set controller.replicaCount=1 \\

&#x20;     --set broker.replicaCount=2 \\

&#x20;     --set listeners.client.protocol=PLAINTEXT \\

&#x20;     --set controller.resources.requests.cpu=100m \\

&#x20;     --set controller.resources.requests.memory=512Mi \\

&#x20;     --set broker.resources.requests.cpu=100m \\

&#x20;     --set broker.resources.requests.memory=512Mi \\

&#x20;     --set controller.persistence.size=4Gi \\

&#x20;     --set broker.persistence.size=4Gi



Note: the `bitnamilegacy/kafka` image is required. Since August 2025, Bitnami

moved its free public images to a legacy catalog, so the chart's default image

path no longer pulls.



\## Verify



&#x20;   kubectl get pods -n kafka



All three pods (kafka-controller-0, kafka-broker-0, kafka-broker-1) should reach

Running and READY 1/1.



\## In-cluster address



Services inside the cluster reach Kafka at:



&#x20;   kafka.kafka.svc.cluster.local:9092



\## Uninstall



&#x20;   helm uninstall kafka -n kafka

&#x20;   kubectl delete pvc --all -n kafka

