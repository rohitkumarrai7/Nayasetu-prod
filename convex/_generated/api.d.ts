/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as advocates from "../advocates.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as citizen from "../citizen.js";
import type * as copilot from "../copilot.js";
import type * as crm from "../crm.js";
import type * as crons from "../crons.js";
import type * as drafting from "../drafting.js";
import type * as firms from "../firms.js";
import type * as geo from "../geo.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as ingestBulk from "../ingestBulk.js";
import type * as intake from "../intake.js";
import type * as leads from "../leads.js";
import type * as lib_answerGuard from "../lib/answerGuard.js";
import type * as lib_chunk from "../lib/chunk.js";
import type * as lib_citation from "../lib/citation.js";
import type * as lib_clean from "../lib/clean.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_demoData from "../lib/demoData.js";
import type * as lib_districtCourts from "../lib/districtCourts.js";
import type * as lib_draftTemplates from "../lib/draftTemplates.js";
import type * as lib_embeddings from "../lib/embeddings.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_hash from "../lib/hash.js";
import type * as lib_legalTriage from "../lib/legalTriage.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_pii from "../lib/pii.js";
import type * as lib_taxonomy from "../lib/taxonomy.js";
import type * as lib_text from "../lib/text.js";
import type * as marketplace from "../marketplace.js";
import type * as model_access from "../model/access.js";
import type * as model_admin from "../model/admin.js";
import type * as model_corpus from "../model/corpus.js";
import type * as model_geo from "../model/geo.js";
import type * as model_retrieval from "../model/retrieval.js";
import type * as research from "../research.js";
import type * as seed from "../seed.js";
import type * as updates from "../updates.js";
import type * as verify from "../verify.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  advocates: typeof advocates;
  analytics: typeof analytics;
  auth: typeof auth;
  chat: typeof chat;
  citizen: typeof citizen;
  copilot: typeof copilot;
  crm: typeof crm;
  crons: typeof crons;
  drafting: typeof drafting;
  firms: typeof firms;
  geo: typeof geo;
  http: typeof http;
  ingest: typeof ingest;
  ingestBulk: typeof ingestBulk;
  intake: typeof intake;
  leads: typeof leads;
  "lib/answerGuard": typeof lib_answerGuard;
  "lib/chunk": typeof lib_chunk;
  "lib/citation": typeof lib_citation;
  "lib/clean": typeof lib_clean;
  "lib/constants": typeof lib_constants;
  "lib/demoData": typeof lib_demoData;
  "lib/districtCourts": typeof lib_districtCourts;
  "lib/draftTemplates": typeof lib_draftTemplates;
  "lib/embeddings": typeof lib_embeddings;
  "lib/geo": typeof lib_geo;
  "lib/hash": typeof lib_hash;
  "lib/legalTriage": typeof lib_legalTriage;
  "lib/llm": typeof lib_llm;
  "lib/pii": typeof lib_pii;
  "lib/taxonomy": typeof lib_taxonomy;
  "lib/text": typeof lib_text;
  marketplace: typeof marketplace;
  "model/access": typeof model_access;
  "model/admin": typeof model_admin;
  "model/corpus": typeof model_corpus;
  "model/geo": typeof model_geo;
  "model/retrieval": typeof model_retrieval;
  research: typeof research;
  seed: typeof seed;
  updates: typeof updates;
  verify: typeof verify;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
