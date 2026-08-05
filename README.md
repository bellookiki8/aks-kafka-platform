# aks-kafka-platform

An event-driven platform on Microsoft Azure. A 3-service application (a producer
API, a consumer, and a frontend) runs on Azure Kubernetes Service (AKS) and
communicates through a self-hosted Apache Kafka cluster. Infrastructure is
provisioned with Terraform, and the same build-and-deploy flow is implemented in
two separate CI/CD systems: Azure DevOps Pipelines (primary) and Jenkins running
on the cluster with Kaniko (secondary).

The point of the project is range and realism: not one pipeline, but two very
different ones shipping the same event-driven app, on infrastructure defined as
code, with the operational rough edges documented honestly.

## What it does

A user places an order in the frontend. The producer API publishes that order to
a Kafka topic and returns immediately. A separate consumer service, running in its
own pods, reads the topic, processes each order, and exposes the results over
HTTP. The producer and consumer never call each other directly; they only share
the Kafka topic. The frontend polls the consumer and shows orders being fulfilled,
including which Kafka partition each one landed on.

## Architecture

```
                         Internet
                            |
                     [ Public IP ]
                            |
                [ Nginx Ingress Controller ]
              /             |               \
         path: /       path: /api      path: /consumer
            |               |                 |
      [ frontend ]     [ producer ]      [ consumer ]
                            |                 ^
                        publishes         reads from
                            v                 |
                     [ Apache Kafka (self-hosted on AKS) ]
                        1 controller + 2 brokers, KRaft

  Infrastructure provisioned by Terraform (AKS + ACR).
  Images stored in Azure Container Registry.
  CI/CD path 1: Azure DevOps Pipelines (hosted agents).
  CI/CD path 2: Jenkins on the cluster, building with Kaniko.
```

## Tech stack

| Layer            | Technology                                                    |
|------------------|---------------------------------------------------------------|
| Cloud            | Microsoft Azure                                               |
| IaC              | Terraform (azurerm, helm providers)                          |
| Orchestration    | Kubernetes (AKS, 2-node pool)                                |
| Event streaming  | Apache Kafka, self-hosted via Helm (KRaft, no ZooKeeper)     |
| Registry         | Azure Container Registry (ACR)                               |
| Ingress          | Nginx ingress controller                                     |
| CI/CD (primary)  | Azure DevOps Pipelines with workload identity federation     |
| CI/CD (secondary)| Jenkins on AKS, building images with Kaniko                  |
| App              | Node.js (producer + consumer), static frontend               |

## Repository layout

```
aks-kafka-platform/
  infra/                 Terraform for AKS and ACR
  app/
    producer/            Producer API: receives orders, publishes to Kafka
    consumer/            Consumer: reads Kafka, processes orders, serves state
    frontend/            Static UI: submits orders, polls the consumer
  k8s/                   Kubernetes manifests (namespace, 3 services, ingress)
  kafka/                 How Kafka is installed (Helm command and notes)
  azure-pipelines.yml    Azure DevOps pipeline
  Jenkinsfile            Jenkins pipeline (Kaniko build + kubectl deploy)
```

## Key design decisions

**Two CI/CD systems, one app.** Azure DevOps runs on Microsoft-hosted agents and
uses workload identity federation to reach Azure. Jenkins runs as a pod on the
cluster and builds images with Kaniko inside ephemeral agent pods. Doing both
shows the same delivery goal solved two ways, and covers two of the most common
CI ecosystems.

**Kafka installed by Helm, not Terraform.** The Bitnami chart does not re-render
cleanly under the Terraform Helm provider after Bitnami's 2025 image-catalog
change, so Kafka is installed with a documented Helm command instead (see
`kafka/`). This keeps it reliable and reproducible without fighting the provider.

**The producer returns 202, not 200.** Its job is done once the order is safely
published to Kafka. It does not wait for processing. That is the asynchronous,
decoupled nature of event-driven systems, expressed in the HTTP semantics.

**The consumer is a single replica with a Recreate strategy.** It holds processed
orders in memory, so running multiple copies in one consumer group would split the
partitions and give inconsistent results. One replica sees everything. A real
system would move that state to a database and then scale freely.

**Topics are created explicitly, as a pipeline step.** A Kafka consumer that
subscribes to a non-existent topic fails hard. Both pipelines create the `orders`
topic (idempotently) before deploying, so a fresh cluster never hits that error.

## How to run it

Prerequisites: an Azure subscription, plus the Azure CLI, Terraform, kubectl,
Helm, Docker, and Git.

```bash
# 1. Provision AKS and ACR
cd infra
terraform init
terraform apply

# 2. Connect kubectl
az aks get-credentials --resource-group rg-kafkaplatform-dev --name aks-kafkaplatform-dev --overwrite-existing

# 3. Install Kafka (see kafka/README.md for the exact command)

# 4. Deploy the app and ingress
kubectl apply -f k8s/

# 5. Get the public IP
kubectl get service -n ingress-nginx ingress-nginx-controller
```

After that, either pipeline builds, pushes, and deploys on a push to `main`.

## Rebuild notes

Kafka, the ingress controller, and Jenkins are installed by Helm outside
Terraform, so after a `terraform destroy` and rebuild they are re-installed with
their documented Helm commands. The CI/CD identities also need their role grants
re-applied on a fresh registry and cluster:

- Azure DevOps service connection needs `AcrPush` on the ACR, plus
  `Azure Kubernetes Service Cluster User Role` and `Azure Kubernetes Service RBAC
  Writer` on the cluster.
- Jenkins uses a service principal with `AcrPush` (for Kaniko) and an admin
  kubeconfig stored as a Jenkins credential (for kubectl).

## Problems faced and how they were solved

This project ran on a governed subscription and used newer tooling, which surfaced
several real, current issues. Working through them was the point.

**Bitnami images stopped pulling.** Since August 2025, Bitnami moved its free
public images to a legacy catalog, so a fresh `bitnami/kafka` install failed with
`ImagePullBackOff`. The fix was to point the chart at `bitnamilegacy/kafka`.

**Kafka would not re-render under the Terraform Helm provider.** After importing
the running release, Terraform kept failing with `invalid_reference: invalid tag`
while trying to reconcile the split image values. Rather than fight it, Kafka was
removed from Terraform state and documented as a Helm command, which is reliable
and equally reproducible.

**A consumer subscribing to a missing topic crashed hard.** The `orders` topic
did not exist when the consumer first started, and it failed with
`This server does not host this topic-partition`. The fix was to create the topic
explicitly, and then to bake topic creation into both pipelines so it can never
recur.

**Azure DevOps hit a wall of permissions.** Each stage failed until the service
connection identity was granted the right role: `AcrPush` for the registry, then
`Cluster User` and `RBAC Writer` for the cluster. That sequence (push rights to
build, cluster rights to deploy) is exactly how a real ADO-to-AKS pipeline is
wired.

**Kaniko shipped an image without its dependencies.** In a loop building three
similar Node images, Kaniko reused a cached filesystem snapshot and the second
image shipped without `node_modules`, crashing with `Cannot find module
'express'`. The fix was `--cache=false --single-snapshot --cleanup`, so each
image builds its own layers cleanly.

## What each layer proves

- Terraform: infrastructure as version-controlled, repeatable code
- Kafka on Kubernetes: StatefulSets, persistent volumes, KRaft, partitions,
  replication, consumer groups
- The app: a genuinely decoupled, event-driven design
- Azure DevOps and Jenkins: the same delivery solved in two CI ecosystems
- Kaniko: building container images securely from inside Kubernetes

## Cost note

The cluster runs two nodes plus Kafka, its disks, the ingress load balancer, and
Jenkins, so it is designed to be torn down with `terraform destroy` (plus a
resource-group delete for the Helm-installed pieces) between sessions and rebuilt
in minutes. All code lives in Git, so a teardown loses nothing.
