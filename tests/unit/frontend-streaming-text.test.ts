import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareAssistantStreamChunk,
  resolveAssistantFinalizeDelay,
} from "../../apps/demo-frontend/public/streaming-text.js";

test("prepareAssistantStreamChunk trims leading whitespace on first chunk", () => {
  const chunk = prepareAssistantStreamChunk("", "   Hello");
  assert.equal(chunk, "Hello");
});

test("prepareAssistantStreamChunk removes indentation after newline boundary", () => {
  const chunk = prepareAssistantStreamChunk("Hello\n", "   next");
  assert.equal(chunk, "next");
});

test("prepareAssistantStreamChunk avoids duplicate single-space prefix", () => {
  const chunk = prepareAssistantStreamChunk("Hello ", "  world");
  assert.equal(chunk, " world");
});

test("resolveAssistantFinalizeDelay keeps idle timeout for mid-sentence chunks", () => {
  const delay = resolveAssistantFinalizeDelay("this is still running", 500, 160);
  assert.equal(delay, 500);
});

test("resolveAssistantFinalizeDelay shortens timeout for sentence-ending chunks", () => {
  const delay = resolveAssistantFinalizeDelay("Done.", 500, 160);
  assert.equal(delay, 160);
});

test("resolveAssistantFinalizeDelay shortens timeout for paragraph break chunks", () => {
  const delay = resolveAssistantFinalizeDelay("line one\n\n", 500, 160);
  assert.equal(delay, 160);
});
