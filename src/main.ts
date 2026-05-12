#!/usr/bin/env node

import { existsSync } from "node:fs";
import cli from "./cli/cli.js";
import { generateResumes } from "./generate/generator.js";

if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
    const argv = await cli.parseArguments();
    await generateResumes(argv);
}

main();
