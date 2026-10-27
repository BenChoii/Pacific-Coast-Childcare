/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as bookkeeping from "../bookkeeping.js";
import type * as calendar from "../calendar.js";
import type * as children from "../children.js";
import type * as connect from "../connect.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as directory from "../directory.js";
import type * as educators from "../educators.js";
import type * as extras from "../extras.js";
import type * as facilities from "../facilities.js";
import type * as familyNotifications from "../familyNotifications.js";
import type * as fileEncryption from "../fileEncryption.js";
import type * as files from "../files.js";
import type * as financeUtils from "../financeUtils.js";
import type * as http from "../http.js";
import type * as incidents from "../incidents.js";
import type * as inquiries from "../inquiries.js";
import type * as invoices from "../invoices.js";
import type * as lessons from "../lessons.js";
import type * as lib from "../lib.js";
import type * as milestones from "../milestones.js";
import type * as notificationSchema from "../notificationSchema.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as ownerEmail from "../ownerEmail.js";
import type * as payments from "../payments.js";
import type * as payroll from "../payroll.js";
import type * as photos from "../photos.js";
import type * as preferences from "../preferences.js";
import type * as privateFileHttp from "../privateFileHttp.js";
import type * as privateFileMigration from "../privateFileMigration.js";
import type * as privateFiles from "../privateFiles.js";
import type * as qaFixtures from "../qaFixtures.js";
import type * as repairSchema from "../repairSchema.js";
import type * as reports from "../reports.js";
import type * as resources from "../resources.js";
import type * as roster from "../roster.js";
import type * as seed from "../seed.js";
import type * as subsidies from "../subsidies.js";
import type * as users from "../users.js";
import type * as workflowSchema from "../workflowSchema.js";
import type * as workflowUtils from "../workflowUtils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  ai: typeof ai;
  auth: typeof auth;
  billing: typeof billing;
  bookkeeping: typeof bookkeeping;
  calendar: typeof calendar;
  children: typeof children;
  connect: typeof connect;
  conversations: typeof conversations;
  crons: typeof crons;
  directory: typeof directory;
  educators: typeof educators;
  extras: typeof extras;
  facilities: typeof facilities;
  familyNotifications: typeof familyNotifications;
  fileEncryption: typeof fileEncryption;
  files: typeof files;
  financeUtils: typeof financeUtils;
  http: typeof http;
  incidents: typeof incidents;
  inquiries: typeof inquiries;
  invoices: typeof invoices;
  lessons: typeof lessons;
  lib: typeof lib;
  milestones: typeof milestones;
  notificationSchema: typeof notificationSchema;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  ownerEmail: typeof ownerEmail;
  payments: typeof payments;
  payroll: typeof payroll;
  photos: typeof photos;
  preferences: typeof preferences;
  privateFileHttp: typeof privateFileHttp;
  privateFileMigration: typeof privateFileMigration;
  privateFiles: typeof privateFiles;
  qaFixtures: typeof qaFixtures;
  repairSchema: typeof repairSchema;
  reports: typeof reports;
  resources: typeof resources;
  roster: typeof roster;
  seed: typeof seed;
  subsidies: typeof subsidies;
  users: typeof users;
  workflowSchema: typeof workflowSchema;
  workflowUtils: typeof workflowUtils;
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
