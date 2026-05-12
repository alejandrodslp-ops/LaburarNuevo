// src/services/authService.js
// Toda la lógica de autenticación en un solo lugar

import { SecureAPI, TokenManager, Encryption, Validators, KEYS, SecureStorage } from './security';

export const AuthService = {

  // ── Registro de nuevo usuario ──
  async register({ email, password, role, name, acceptedTerms }) {

    // Validar antes de enviar
    if (!Validators.email(email))       throw new Error('Email no válido');
    if (!Validators.password(password)) throw new Error('Contraseña muy corta');
    if (!acceptedTerms)                 throw new Error('Debés aceptar los términos');

    // El cliente hashea la contraseña antes de enviar
    // El servidor también hashea con bcrypt — doble capa
    const passwordHash = await Encryption.hashData(password);

    const data = await SecureAPI.post('/auth/register', {
      email:          email.toLowerCase().trim(),
      password_hash:  passwordHash,
      role,           // 'worker' | 'employer' | 'company'
      name:           Encryption.sanitizeInput(name),
      accepted_terms: acceptedTerms,
      accepted_at:    new Date().toISOString(),
    });

    await TokenManager.saveTokens(data.session_token, data.refresh_token);
    await SecureStorage.set(KEYS.USER_DATA, data.user);

    return data.user;
  },

  // ── Login con email y contraseña ──
  async login({ email, password }) {
    if (!Validators.email(email)) throw new Error('Email no válido');
    if (!password)                throw new Error('Ingresá tu contraseña');

    const passwordHash = await Encryption.hashData(password);

    const data = await SecureAPI.post('/auth/login', {
      email:         email.toLowerCase().trim(),
      password_hash: passwordHash,
    });

    await TokenManager.saveTokens(data.session_token, data.refresh_token);
    await SecureStorage.set(KEYS.USER_DATA, data.user);

    return data.user;
  },

  // ── Login con Google ──
  async loginWithGoogle(googleToken) {
    const data = await SecureAPI.post('/auth/google', { token: googleToken });
    await TokenManager.saveTokens(data.session_token, data.refresh_token);
    await SecureStorage.set(KEYS.USER_DATA, data.user);
    return data.user;
  },

  // ── Login con Apple ──
  async loginWithApple(appleCredential) {
    const data = await SecureAPI.post('/auth/apple', {
      identity_token: appleCredential.identityToken,
      user_id:        appleCredential.user,
      full_name:      appleCredential.fullName,
    });
    await TokenManager.saveTokens(data.session_token, data.refresh_token);
    await SecureStorage.set(KEYS.USER_DATA, data.user);
    return data.user;
  },

  // ── Recuperar sesión guardada ──
  async restoreSession() {
    const token = await TokenManager.getSessionToken();
    if (!token) return null;

    if (TokenManager.isTokenExpired(token)) {
      const renewed = await SecureAPI.renewToken();
      if (!renewed) {
        await this.logout();
        return null;
      }
    }

    const userData = await SecureStorage.get(KEYS.USER_DATA);
    return userData;
  },

  // ── Logout completo ──
  async logout() {
    try {
      // Notificar al servidor (para invalidar el token en la base de datos)
      await SecureAPI.post('/auth/logout', {}).catch(() => {});
    } finally {
      // Siempre limpiar localmente aunque falle el servidor
      await SecureStorage.clearAll();
    }
  },

  // ── Cambiar contraseña ──
  async changePassword({ currentPassword, newPassword }) {
    if (!Validators.password(newPassword)) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const currentHash = await Encryption.hashData(currentPassword);
    const newHash     = await Encryption.hashData(newPassword);

    return SecureAPI.post('/auth/change-password', {
      current_password_hash: currentHash,
      new_password_hash:     newHash,
    });
  },

  // ── Solicitar reset de contraseña ──
  async requestPasswordReset(email) {
    if (!Validators.email(email)) throw new Error('Email no válido');
    return SecureAPI.post('/auth/request-reset', {
      email: email.toLowerCase().trim(),
    });
  },

  // ── Eliminar cuenta ──
  async deleteAccount(password) {
    const passwordHash = await Encryption.hashData(password);
    await SecureAPI.post('/auth/delete-account', { password_hash: passwordHash });
    await SecureStorage.clearAll();
  },
};
