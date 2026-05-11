#!/usr/bin/env node

import cli from "./cli/cli.js";
import { generateResumes } from "./generate/generator.js";

async function main() {
    const argv = await cli.parseArguments();
    await generateResumes(argv);
}

main();
