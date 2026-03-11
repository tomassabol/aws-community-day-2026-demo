# You may not need a Lambda

# AWS Community Day 2026 – Demo Collection

A collection of hands-on demos showcasing **direct AWS service integrations** vs **Lambda-mediated** patterns. Each demo illustrates when and how to choose native integrations for lower latency, reduced cost, and simpler architectures.

## Demos Overview

| Demo        | Topic                                                     | Key Services                                                   |
| ----------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| **Demo 01** | Lambda vs direct EventBridge integration                  | API Gateway, EventBridge, SQS                                  |
| **Demo 02** | AppSync direct resolvers vs Lambda resolvers              | AppSync, DynamoDB                                              |
| **Demo 03** | Return processing with Step Functions direct integrations | Step Functions, DynamoDB, Rekognition, Bedrock, SNS, Translate |
| **Demo 04** | AppSync direct integration with Aurora Data API           | AppSync, Aurora Serverless, RDS Data API                       |

### Demo 01 – EventBridge: Lambda vs Direct Integration

Compares publishing events from API Gateway via **Lambda** vs **direct EventBridge integration**. Both paths trigger the same downstream consumers (SQS, Lambda validators), demonstrating trade-offs in latency and architecture.

- **Endpoints**: `POST /submissions/lambda` vs `POST /submissions/direct`
- **Outputs**: Event bus, observation queue, API URL

### Demo 02 – AppSync: Direct Resolvers vs Lambda

GraphQL API with two mutation paths for creating submissions:

- **Direct resolver** – JavaScript resolver talking to DynamoDB
- **Lambda resolver** – TypeScript Lambda with business logic

Both read from the same DynamoDB table; ideal for comparing cold starts and operational complexity.

### Demo 03 – Step Functions Direct Integrations

E-commerce return processing workflow using Step Functions with **native AWS integrations** (no Lambda):

- **DynamoDB** – Put/Get items
- **Rekognition** – Image label detection
- **Bedrock** – Fraud recommendation (Nova Micro)
- **Translate** – Multi-language notifications
- **SNS** – Customer notifications

Demonstrates building a full workflow with only state machine states and direct service calls.

### Demo 04 – AppSync + Aurora Data API

AppSync GraphQL API directly integrated with **Aurora Serverless v2** via the **Data API**. No Lambda or VPC resolvers—queries and mutations go straight from AppSync to Aurora.

- **VPC** – Isolated subnets for Aurora
- **Aurora Serverless v2** – PostgreSQL with Data API
- **AppSync** – HTTP resolver calling Data API

---

## Prerequisites

- **Bun** or Node.js 22+
- **AWS CLI** configured with appropriate credentials
- **AWS CDK** (`bunx cdk` or `npx cdk`)

## Installation

```bash
bun install
```

## Deployment

Deploy all stacks (app + demo-01 through demo-04):

```bash
./scripts/cdk.sh deploy app --profile <AWS-PROFILE> --stage <STAGE>
```

Example:

```bash
./scripts/cdk.sh deploy app --profile default --stage ts
```

Other commands:

```bash
./scripts/cdk.sh synth app --profile <PROFILE> --stage <STAGE>
./scripts/cdk.sh diff app --profile <PROFILE> --stage <STAGE>
./scripts/cdk.sh destroy app --profile <PROFILE> --stage <STAGE>
```

### CI/CD pipeline (optional)

```bash
./scripts/cdk.sh deploy app-pipeline --profile <AWS-PROFILE> --stage <STAGE>
```

---

## Project Structure

```
├── infra/
│   ├── config/           # App config per stage
│   ├── constructs/       # CDK constructs
│   └── stacks/           # Demo stacks
├── scripts/
│   └── cdk.sh            # CDK deploy/synth/diff/destroy
└── src/
    ├── api/              # Shared API handlers
    ├── appsync/          # GraphQL schemas and resolvers
    ├── demo/             # Shared demo utilities
    ├── functions/        # Lambda handlers
    └── shared/           # Shared contracts and types
```

---

## Technology Stack

| Category       | Technology                  |
| -------------- | --------------------------- |
| Runtime        | Bun / Node.js 22            |
| Language       | TypeScript 5.9              |
| Infrastructure | AWS CDK 2.x                 |
| API            | API Gateway REST, AppSync   |
| Compute        | Lambda, Step Functions      |
| Data           | DynamoDB, Aurora Serverless |
| AI/ML          | Amazon Bedrock (Nova Micro) |
| Validation     | Zod                         |

---

## License

MIT
