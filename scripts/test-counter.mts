#!/usr/bin/env tsx
// Checks the page counter against the real counter document pulled from live.
// Mutates the LOCAL counter only, and restores it before exiting.
import { connect } from "../src/lib/mongodb";
import { nextPage, peekCounter, raiseCounterTo, IdentityCounterModel } from "../src/lib/page-counter";

await connect();

const start = await peekCounter();
console.log(`\n  counter as pulled from live: ${start}`);

const a = await nextPage();
const b = await nextPage();
console.log(`  nextPage() -> ${a}, ${b}`);

await raiseCounterTo(b - 5);
console.log(`  raiseCounterTo(${b - 5}) (lower) -> counter still ${await peekCounter()}`);

await raiseCounterTo(b + 10);
console.log(`  raiseCounterTo(${b + 10}) (higher) -> counter now ${await peekCounter()}`);

// Restore so local stays in step with production.
await IdentityCounterModel.updateOne({ model: "Piece", field: "page" }, { count: start });
console.log(`  restored to ${await peekCounter()}`);

const expectA = (start ?? -1) + 1;
const ok = a === expectA && b === expectA + 1;
console.log(`\n  ${ok ? "PASS" : "FAIL"} — expected ${expectA}, ${expectA + 1}\n`);
process.exit(ok ? 0 : 1);
