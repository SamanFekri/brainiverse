#!/usr/bin/env node
// Brainiverse runtime CLI. Agents and the Leader call this from inside the installed skill.
import { main } from "../runtime/cli.mjs";

process.exitCode = main();
