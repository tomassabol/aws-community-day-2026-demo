# AWS Cloud Control Agent

AWS Cloud Control Agent is an autonomous AI agent that investigates CloudWatch alarms and performs root cause analysis on AWS infrastructure issues. When alarms trigger, the agent automatically queries logs, analyzes metrics, and provides actionable recommendations — all powered by Claude Sonnet 4 via Amazon Bedrock.

## Architecture

1. **CloudWatch Alarm** triggers when metrics breach thresholds
2. **EventBridge Rule** captures alarm state changes
3. **Step Functions** orchestrates the analysis workflow
4. **Lambda Agent** runs the AI-powered investigation using Claude Sonnet 4
5. **AWS APIs** provide read-only access to infrastructure data

## Getting Started

### Prerequisites

- Node.js 22+
- AWS CLI configured with appropriate credentials

### Installation

```bash
npm install
```

### Deploy

Deploy the application stack:

```bash
./scripts/cdk.sh deploy app --profile <AWS-PROFILE> --stage <STAGE>
```

Deploy the CI/CD pipeline (optional):

```bash
./scripts/cdk.sh deploy app-pipeline --profile <AWS-PROFILE> --stage <STAGE>
```

## How It Works

When a CloudWatch alarm triggers, the agent:

1. **Extracts Context** — Parses alarm name, description, region, timestamp, and affected resources
2. **Queries Logs** — Searches CloudWatch Logs for errors around the alarm timestamp
3. **Analyzes Patterns** — Identifies error patterns, stack traces, and anomalies
4. **Checks Configuration** — Inspects Lambda/service configuration for misconfigurations
5. **Generates Report** — Produces a structured analysis with:
   - **Root Cause** — Brief explanation of what went wrong
   - **Evidence** — Key log entries and metrics supporting the conclusion
   - **Recommendations** — Specific actions to fix or prevent the issue

### Example Output

```json
{
  "statusCode": 200,
  "body": {
    "summary": "Root Cause: The Lambda function timed out due to...",
    "metadata": {
      "alarmName": "lambda-errors-high",
      "region": "eu-west-1",
      "timestamp": "2025-01-05T10:30:00Z",
      "steps": 5,
      "tokensUsed": {
        "input": 2500,
        "output": 800
      }
    }
  }
}
```

## Technology Stack

| Category           | Technology                         |
| ------------------ | ---------------------------------- |
| **Runtime**        | Node.js 22, Bun (development)      |
| **Language**       | TypeScript 5.9                     |
| **AI/LLM**         | Claude Sonnet 4 via Amazon Bedrock |
| **AI Framework**   | Vercel AI SDK 6.0                  |
| **Infrastructure** | AWS CDK 2.222                      |
| **Compute**        | AWS Lambda                         |
| **Orchestration**  | AWS Step Functions                 |
| **Events**         | Amazon EventBridge                 |
| **Validation**     | Zod                                |
| **Testing**        | Jest                               |

## License

MIT
