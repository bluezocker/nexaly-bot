export {
  evaluateDashboardAccess,
  evaluateModerationHierarchy,
  assertGuildScope,
  type DashboardAccessReason,
  type GuildPermissionInput,
  type GuildAccessResult,
  type HierarchyInput,
} from "./permissions.js";
export { PermissionFlags, parsePermissionBits, hasPermission } from "./discord-permissions.js";
export { AppError, unauthorized, guildForbidden, notFound, validationError, type ErrorCode } from "./errors.js";
export {
  MODULE_KEYS,
  DEFAULT_BOT_PERMISSIONS,
  DISCORD_API_BASE,
  DISCORD_OAUTH_AUTHORIZE,
  DISCORD_OAUTH_TOKEN,
  type ModuleKey,
} from "./constants.js";
export {
  LOG_EVENTS,
  LOG_EVENT_KEYS,
  LOG_EVENT_GROUPS,
  logSettingsUpdateSchema,
  pickAuditExecutor,
  truncateEmbed,
  configChannel,
  DISCORD_EMBED_DESCRIPTION_LIMIT,
  DISCORD_EMBED_FIELD_LIMIT,
  type LogEventKey,
  type LogSettingsUpdate,
  type AuditCandidate,
} from "./logs.js";
export {
  moderationSettingsUpdateSchema,
  moderationRuleSchema,
  detectFlood,
  detectDuplicate,
  detectMentions,
  detectEmoji,
  detectCaps,
  detectLinks,
  matchWordRule,
  isRegexPatternSafe,
  REGEX_MAX_INPUT,
  nextLadderAction,
  normalizeForDuplicate,
  normalizeHost,
  hostMatchesList,
  isDiscordInvite,
  extractUrls,
  DEFAULT_LADDER,
  MOD_ACTIONS,
  type ModerationSettingsUpdate,
  type ModerationRuleInput,
  type DetectorHit,
  type ModActionName,
} from "./moderation.js";
export {
  welcomeSettingsUpdateSchema,
  welcomeEmbedSchema,
  interpolateWelcome,
  welcomeVars,
  DEFAULT_WELCOME_TEXT,
  DEFAULT_WELCOME_DM,
  WELCOME_QUEUE,
  welcomeResultKey,
  WELCOME_MODES,
  type WelcomeSettingsUpdate,
  type WelcomeVars,
  type WelcomeCardJob,
  type WelcomeModeName,
} from "./welcome.js";
export {
  levelSettingsUpdateSchema,
  xpToNextLevel,
  totalXpForLevel,
  levelFromXp,
  randomXp,
  type LevelSettingsUpdate,
} from "./levels.js";
export {
  embedPayloadSchema,
  embedTemplateSchema,
  embedSendSchema,
  reactionRoleSchema,
  existingReactionSchema,
  toDiscordEmbed,
  type EmbedPayload,
} from "./embeds.js";
export {
  STREAM_PLATFORMS,
  streamSubscriptionSchema,
  interpolateStream,
  DEFAULT_STREAM_TEMPLATE,
  type StreamPlatform,
  type StreamSubscriptionInput,
  type StreamChannelInfo,
  type LiveStreamInfo,
  type StreamProvider,
} from "./streams.js";
export {
  createStreamProviders,
  parseYoutubeFeedVideoIds,
  type StreamProviderEnv,
} from "./stream-providers.js";
export {
  MODULE_LABELS,
  TIMEZONES,
  guildSettingsUpdateSchema,
  type GuildSettingsUpdate,
} from "./settings.js";
export { ticketSettingsSchema, type TicketSettingsInput } from "./tickets.js";
export {
  SOCIAL_PLATFORMS,
  socialSubscriptionSchema,
  normalizeHandle,
  lookupXUser,
  fetchXPosts,
  fetchThreadsProfile,
  fetchThreadsPosts,
  refreshThreadsToken,
  type SocialPlatformName,
  type SocialPost,
} from "./social.js";

