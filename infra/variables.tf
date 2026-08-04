variable "subscription_id" {
  description = "Azure subscription ID to deploy into"
  type        = string
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "westeurope"
}

variable "project" {
  description = "Short project name used in resource naming"
  type        = string
  default     = "kafkaplatform"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "node_count" {
  description = "Number of nodes in the AKS pool"
  type        = number
  default     = 2
}
