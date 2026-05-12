export const SecureStorage = { set: async () => {}, get: async () => null, delete: async () => {}, clearAll: async () => {} };
export const TokenManager = { saveTokens: async () => {}, getSessionToken: async () => null, getRefreshToken: async () => null, clearTokens: async () => {}, isTokenExpired: () => true };
export const Encryption = { hashData: async (d) => d, sanitizeInput: (t) => t, sanitizeObject: (o) => o, maskSensitive: (v) => v };
export const Validators = { email: (e) => e?.includes('@'), password: (p) => p?.length >= 8, safeText: () => true, phone: () => true };
export const SecureAPI = { get: async () => ({}), post: async () => ({}), put: async () => ({}), delete: async () => ({}) };
export class APIError extends Error { constructor(s, m) { super(m); this.status = s; } }
export function checkRateLimit() { return true; }
export const KEYS = {};
