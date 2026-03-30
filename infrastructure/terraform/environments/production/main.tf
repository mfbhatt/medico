terraform {
  required_version = ">= 1.7"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.48"
    }
  }
  backend "azurerm" {
    resource_group_name  = "clinic-mgmt-tfstate-rg"
    storage_account_name = "clinicmgmttfstate"
    container_name       = "tfstate"
    key                  = "production.terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
  }
}

locals {
  env         = "production"
  location    = "East US 2"
  prefix      = "clinic-mgmt-prod"
  tags = {
    Environment = "Production"
    Project     = "ClinicManagement"
    ManagedBy   = "Terraform"
  }
}

# ─── Resource Group ──────────────────────────────────────────────
resource "azurerm_resource_group" "main" {
  name     = "${local.prefix}-rg"
  location = local.location
  tags     = local.tags
}

# ─── Azure Kubernetes Service ────────────────────────────────────
module "aks" {
  source = "../../modules/aks"

  name                = "${local.prefix}-aks"
  resource_group_name = azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags

  node_count     = 3
  min_count      = 2
  max_count      = 10
  node_vm_size   = "Standard_D4s_v3"
  kubernetes_version = "1.29"
}

# ─── PostgreSQL Flexible Server ──────────────────────────────────
module "postgresql" {
  source = "../../modules/postgresql"

  name                = "${local.prefix}-pg"
  resource_group_name = azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags

  sku_name    = "GP_Standard_D4s_v3"
  storage_mb  = 131072   # 128 GB
  backup_retention_days = 35
  geo_redundant_backup  = true

  databases = ["clinic_db"]
}

# ─── Azure Cache for Redis ───────────────────────────────────────
module "redis" {
  source = "../../modules/redis"

  name                = "${local.prefix}-redis"
  resource_group_name = azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags

  sku_name   = "Premium"
  family     = "P"
  capacity   = 1
  enable_ssl = true
}

# ─── Azure Blob Storage ──────────────────────────────────────────
module "storage" {
  source = "../../modules/blob_storage"

  name                = "clinicmgmtprodstorage"
  resource_group_name = azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags

  account_tier             = "Standard"
  account_replication_type = "GRS"

  containers = [
    "clinic-files",
    "patient-documents",
    "lab-reports",
    "prescriptions",
    "backups",
  ]
}

# ─── Azure Service Bus ───────────────────────────────────────────
module "service_bus" {
  source = "../../modules/service_bus"

  name                = "${local.prefix}-sb"
  resource_group_name = azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags

  sku = "Standard"

  queues = [
    "clinic-notifications",
    "clinic-tasks",
    "clinic-emails",
    "clinic-sms",
  ]
}

# ─── Azure Key Vault ─────────────────────────────────────────────
module "key_vault" {
  source = "../../modules/key_vault"

  name                = "${local.prefix}-kv"
  resource_group_name = azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags

  sku_name = "premium"
  purge_protection_enabled = true
}

# ─── Azure Communication Services ────────────────────────────────
resource "azurerm_communication_service" "main" {
  name                = "${local.prefix}-acs"
  resource_group_name = azurerm_resource_group.main.name
  data_location       = "United States"
  tags                = local.tags
}

# ─── Application Insights ────────────────────────────────────────
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.prefix}-law"
  resource_group_name = azurerm_resource_group.main.name
  location            = local.location
  sku                 = "PerGB2018"
  retention_in_days   = 90
  tags                = local.tags
}

resource "azurerm_application_insights" "main" {
  name                = "${local.prefix}-ai"
  resource_group_name = azurerm_resource_group.main.name
  location            = local.location
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.tags
}

# ─── Azure CDN ───────────────────────────────────────────────────
resource "azurerm_cdn_profile" "main" {
  name                = "${local.prefix}-cdn"
  resource_group_name = azurerm_resource_group.main.name
  location            = "global"
  sku                 = "Standard_Microsoft"
  tags                = local.tags
}

# ─── Outputs ─────────────────────────────────────────────────────
output "aks_cluster_name" {
  value = module.aks.cluster_name
}

output "postgres_host" {
  value     = module.postgresql.host
  sensitive = true
}

output "redis_hostname" {
  value     = module.redis.hostname
  sensitive = true
}

output "storage_account_name" {
  value = module.storage.account_name
}

output "app_insights_key" {
  value     = azurerm_application_insights.main.instrumentation_key
  sensitive = true
}
