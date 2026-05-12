// src/components/UI.js
// Componentes reutilizables — se usan en todas las pantallas

import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

const { width } = Dimensions.get('window');

// ════════════════════════════
// BOTONES
// ════════════════════════════

// Botón primario coral con degradado
export function ButtonPrimary({ label, onPress, loading = false, disabled = false, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.btnWrap, style]}
    >
      <LinearGradient
        colors={disabled ? [COLORS.texto4, COLORS.texto3] : [COLORS.coral, COLORS.coralDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.btnGrad}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.blanco} size="small" />
        ) : (
          <Text style={styles.btnPrimaryText}>{label}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Botón secundario outline
export function ButtonOutline({ label, onPress, color = COLORS.indigo, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.btnOutline, { borderColor: color }, style]}
    >
      <Text style={[styles.btnOutlineText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Botón de texto (link)
export function ButtonText({ label, onPress, color = COLORS.indigo, style }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={style}>
      <Text style={[styles.btnTextStyle, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ════════════════════════════
// INPUTS
// ════════════════════════════

export function Input({
  label, placeholder, value, onChangeText,
  secureTextEntry = false, keyboardType = 'default',
  error, autoCapitalize = 'none', multiline = false,
  numberOfLines = 1, maxLength, editable = true,
  rightIcon, onRightIconPress, style,
}) {
  return (
    <View style={[styles.inputWrap, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View style={[
        styles.inputBox,
        error && styles.inputBoxError,
        !editable && styles.inputBoxDisabled,
        multiline && { height: numberOfLines * 44, alignItems: 'flex-start' },
      ]}>
        <TextInput
          style={[styles.inputField, multiline && { textAlignVertical: 'top', paddingTop: 12 }]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.texto4}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          maxLength={maxLength}
          editable={editable}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.inputRight}>
            <Text style={{ fontSize: 18 }}>{rightIcon}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.inputError}>{error}</Text> : null}
    </View>
  );
}

// ════════════════════════════
// CARDS
// ════════════════════════════

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, style]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ════════════════════════════
// BADGES / TAGS
// ════════════════════════════

export function Badge({ label, color = COLORS.mentaDark, bg = COLORS.mentaSoft, style }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ════════════════════════════
// DIVIDER
// ════════════════════════════

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

// ════════════════════════════
// EMPTY STATE
// ════════════════════════════

export function EmptyState({ emoji, title, subtitle, action, actionLabel }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {action && actionLabel ? (
        <ButtonPrimary label={actionLabel} onPress={action} style={{ marginTop: SIZES.lg }} />
      ) : null}
    </View>
  );
}

// ════════════════════════════
// AVATAR
// ════════════════════════════

export function Avatar({ emoji = '👤', size = 48, bg = COLORS.coral, style }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, style]}>
      <Text style={{ fontSize: size * 0.45 }}>{emoji}</Text>
    </View>
  );
}

// ════════════════════════════
// RATING STARS
// ════════════════════════════

export function Stars({ rating = 0, size = 14, onPress }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity
          key={star}
          onPress={onPress ? () => onPress(star) : undefined}
          disabled={!onPress}
        >
          <Text style={{ fontSize: size, color: rating >= star ? COLORS.gold : COLORS.texto4 }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ════════════════════════════
// SWITCH ROW
// ════════════════════════════

export function SwitchRow({ label, subtitle, value, onValueChange }) {
  const { Switch } = require('react-native');
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {subtitle ? <Text style={styles.switchSub}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.borde, true: COLORS.coral }}
        thumbColor={COLORS.blanco}
      />
    </View>
  );
}

// ════════════════════════════
// SECTION HEADER
// ════════════════════════════

export function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ════════════════════════════
// LOADING OVERLAY
// ════════════════════════════

export function LoadingOverlay({ visible }) {
  if (!visible) return null;
  return (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color={COLORS.coral} />
    </View>
  );
}

// ════════════════════════════
// ESTILOS
// ════════════════════════════
const styles = StyleSheet.create({
  // Botones
  btnWrap: {
    borderRadius: SIZES.radiusMd,
    overflow: 'hidden',
    ...SHADOWS.coral,
  },
  btnGrad: {
    height: SIZES.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.lg,
  },
  btnPrimaryText: {
    color: COLORS.blanco,
    fontSize: SIZES.textLg,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnOutline: {
    height: SIZES.buttonHeight,
    borderRadius: SIZES.radiusMd,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.lg,
  },
  btnOutlineText: {
    fontSize: SIZES.textLg,
    fontWeight: '700',
  },
  btnTextStyle: {
    fontSize: SIZES.textMd,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Inputs
  inputWrap: {
    marginBottom: SIZES.md,
  },
  inputLabel: {
    fontSize: SIZES.textSm,
    fontWeight: '700',
    color: COLORS.texto2,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blanco,
    borderWidth: 1.5,
    borderColor: COLORS.borde,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    minHeight: SIZES.inputHeight,
  },
  inputBoxError: {
    borderColor: COLORS.error,
  },
  inputBoxDisabled: {
    backgroundColor: COLORS.cremaDark,
    borderColor: COLORS.borde,
  },
  inputField: {
    flex: 1,
    fontSize: SIZES.textMd,
    color: COLORS.texto1,
    height: SIZES.inputHeight,
  },
  inputRight: {
    padding: SIZES.sm,
  },
  inputError: {
    fontSize: SIZES.textXs,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 4,
  },

  // Cards
  card: {
    backgroundColor: COLORS.blanco,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.borde,
    ...SHADOWS.sm,
  },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SIZES.radiusSm,
  },
  badgeText: {
    fontSize: SIZES.textXs,
    fontWeight: '700',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.borde,
    marginVertical: SIZES.sm,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.xxl,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: SIZES.md,
  },
  emptyTitle: {
    fontSize: SIZES.text3xl,
    fontWeight: '800',
    color: COLORS.texto1,
    marginBottom: SIZES.sm,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptySub: {
    fontSize: SIZES.textMd,
    color: COLORS.texto3,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Avatar
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stars
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },

  // Switch
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borde,
    gap: SIZES.md,
  },
  switchLabel: {
    fontSize: SIZES.textMd,
    fontWeight: '600',
    color: COLORS.texto1,
    marginBottom: 2,
  },
  switchSub: {
    fontSize: SIZES.textSm,
    color: COLORS.texto3,
    lineHeight: 18,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  sectionTitle: {
    fontSize: SIZES.textLg,
    fontWeight: '800',
    color: COLORS.texto1,
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontSize: SIZES.textSm,
    fontWeight: '700',
    color: COLORS.indigo,
  },

  // Loading
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
