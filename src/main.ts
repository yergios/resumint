#!/usr/bin/env node

import cli from "./cli.js";
import { generateResumes } from "./generator.js";

async function main() {
    const argv = await cli.parseArguments();
    await generateResumes(argv);
}

main();
