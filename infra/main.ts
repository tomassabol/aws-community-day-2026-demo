#!/usr/bin/env node
/* eslint-disable no-console */
import "source-map-support/register"

import {
  AppContext,
  AppContextError,
  DevopsAppPipelineStack,
} from "@tomassabol/cdk-template"

import { AppStack } from "./stacks/app-stack"
import { Demo01Stack } from "./stacks/demo-01-stack"
import { Demo02Stack } from "./stacks/demo-02-stack"
import { Demo03Stack } from "./stacks/demo-03-stack"
import { Demo04Stack } from "./stacks/demo-04-stack"

/**
 * Main file for CDK deployment
 */

try {
  const appContext = new AppContext()

  DevopsAppPipelineStack.fromAppContext(appContext, "devops-app-pipeline")
  AppStack.fromAppContext(appContext, "app")
  Demo01Stack.fromAppContext(appContext, "demo-01")
  Demo02Stack.fromAppContext(appContext, "demo-02")
  Demo03Stack.fromAppContext(appContext, "demo-03")
  Demo04Stack.fromAppContext(appContext, "demo-04")
} catch (error) {
  console.error("\n")
  if (error instanceof AppContextError) {
    console.error("[AppContextError]:", error.message)
  } else {
    console.error(error)
  }
  process.exit(1)
}
