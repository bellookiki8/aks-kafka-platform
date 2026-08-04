# aks-kafka-platform

An event-driven platform on Azure. A 3-service application (frontend, producer
API, and consumer) runs on Azure Kubernetes Service (AKS), communicating through
a self-hosted Apache Kafka cluster. Infrastructure is provisioned with Terraform,
and delivery runs through Azure DevOps Pipelines (with a Jenkins pipeline added
as a second path).

## Stack
- **Cloud:** Microsoft Azure
- **IaC:** Terraform
- **Orchestration:** Kubernetes (AKS)
- **Event streaming:** Apache Kafka (self-hosted on AKS via Helm)
- **Registry:** Azure Container Registry (ACR)
- **CI/CD:** Azure DevOps Pipelines (primary), Jenkins (secondary)
- **App:** frontend + producer API + consumer (Node.js)

## Status
Work in progress. Built phase by phase.
