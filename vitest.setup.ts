// Tests are hermetic: never pick up real provider keys from the developer's shell (a globally
// exported GROQ_API_KEY made "no LLM" tests call the network and time out). Tests that exercise a
// provider set the variables they need and stub fetch.
for (const k of ["GROQ_API_KEY", "GROQ_MODEL", "GEMINI_API_KEY", "GEMINI_FREE_API_KEY", "GEMINI_PAID_API_KEY", "GEMINI_ALLOW_PRIVILEGED", "APIFY_TOKEN", "APIFY_ACTOR"]) {
  delete process.env[k];
}
