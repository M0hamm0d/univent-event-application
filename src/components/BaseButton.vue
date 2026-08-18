<script setup>
import { computed, useSlots } from 'vue'
import { PhSpinner } from '@phosphor-icons/vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) =>
      [
        'primary',
        'primary-outline',
        'secondary',
        'outline',
        'ghost',
        'danger',
        'danger-outline',
        'soft-danger',
        'success',
        'dark',
      ].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  block: { type: Boolean, default: false },
  iconOnly: { type: Boolean, default: false },
  round: { type: Boolean, default: false },
  pill: { type: Boolean, default: false },
  shadow: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
  to: { type: [String, Object], default: null },
  href: { type: String, default: null },
})

const emit = defineEmits(['click'])

const slots = useSlots()

const isDisabled = computed(() => props.disabled || props.loading)

const rootTag = computed(() => {
  if (props.to) return 'router-link'
  if (props.href) return 'a'
  return 'button'
})

const componentProps = computed(() => {
  if (props.to) return { to: props.to }
  if (props.href) return { href: props.href }
  return { type: props.type }
})

const classes = computed(() => [
  'base-btn',
  `base-btn--${props.variant}`,
  `base-btn--${props.size}`,
  {
    'base-btn--block': props.block,
    'base-btn--icon-only': props.iconOnly,
    'base-btn--round': props.round,
    'base-btn--pill': props.pill,
    'base-btn--shadow': props.shadow,
    'base-btn--loading': props.loading,
    'base-btn--has-icon-left': !!slots['icon-left'],
    'base-btn--has-icon-right': !!slots['icon-right'],
  },
])

function onClick(e) {
  if (isDisabled.value) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  emit('click', e)
}
</script>

<template>
  <component
    :is="rootTag"
    :class="classes"
    :disabled="rootTag === 'button' ? isDisabled : undefined"
    :aria-disabled="rootTag !== 'button' && isDisabled ? 'true' : undefined"
    v-bind="componentProps"
    @click="onClick"
  >
    <span v-if="loading" class="base-btn__spinner">
      <slot name="loading">
        <PhSpinner :size="size === 'lg' ? 20 : size === 'sm' ? 14 : 16" />
      </slot>
    </span>
    <span v-if="slots['icon-left']" class="base-btn__icon base-btn__icon--left">
      <slot name="icon-left" />
    </span>
    <span v-if="iconOnly" class="base-btn__icon">
      <slot name="icon-left" />
    </span>
    <span v-if="!iconOnly || slots.default" class="base-btn__label">
      <slot />
    </span>
    <span v-if="slots['icon-right']" class="base-btn__icon base-btn__icon--right">
      <slot name="icon-right" />
    </span>
  </component>
</template>

<style scoped>
.base-btn {
  --_radius: var(--btn-radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--_radius);
  font-weight: 600;
  font-family: inherit;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
}

/* Sizes */
.base-btn--sm {
  padding: 8px 16px;
  font-size: 13px;
}
.base-btn--md {
  padding: 12px 22px;
  font-size: 14px;
}
.base-btn--lg {
  padding: 14px 24px;
  font-size: 16px;
  border-radius: var(--btn-radius-lg);
}

/* Block */
.base-btn--block {
  width: 100%;
}

/* Round (circular) */
.base-btn--round {
  border-radius: var(--btn-radius-circle);
}

/* Pill */
.base-btn--pill {
  border-radius: var(--btn-radius-pill);
}

/* Shadow */
.base-btn--shadow {
  box-shadow: 0 4px 6px -1px var(--btn-primary-shadow);
}

/* ---------- Variants ---------- */
.base-btn--primary {
  background: var(--btn-primary);
  color: var(--btn-white);
  border-color: var(--btn-primary);
}
.base-btn--primary:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-primary-hover);
  border-color: var(--btn-primary-hover);
}

.base-btn--primary-outline {
  background: transparent;
  color: var(--btn-primary);
  border-color: var(--btn-primary);
}
.base-btn--primary-outline:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-primary);
  color: var(--btn-white);
}

.base-btn--secondary {
  background: var(--btn-bg-soft);
  color: var(--btn-text);
  border-color: transparent;
}
.base-btn--secondary:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-bg-softer);
}

.base-btn--outline {
  background: transparent;
  color: var(--btn-text-muted);
  border-color: var(--btn-border);
}
.base-btn--outline:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-bg-softer);
  border-color: var(--btn-border-strong);
}

.base-btn--ghost {
  background: transparent;
  color: var(--btn-danger);
  border-color: var(--btn-danger-border-soft);
}
.base-btn--ghost:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-danger-bg-softer);
}

.base-btn--danger {
  background: var(--btn-danger);
  color: var(--btn-white);
  border-color: var(--btn-danger);
}
.base-btn--danger:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-danger-hover);
  border-color: var(--btn-danger-hover);
}

.base-btn--danger-outline {
  background: transparent;
  color: var(--btn-danger);
  border-color: var(--btn-danger);
}
.base-btn--danger-outline:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-danger);
  color: var(--btn-white);
}

.base-btn--soft-danger {
  background: var(--btn-danger-bg-soft);
  color: var(--btn-danger);
  border-color: transparent;
}
.base-btn--soft-danger:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-danger-border-soft);
}

.base-btn--success {
  background: var(--btn-success);
  color: var(--btn-white);
  border-color: var(--btn-success);
}
.base-btn--success:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-success-hover);
  border-color: var(--btn-success-hover);
}

.base-btn--dark {
  background: var(--btn-dark);
  color: var(--btn-white);
  border-color: var(--btn-dark);
}
.base-btn--dark:hover:not(:disabled):not([aria-disabled='true']) {
  background: #000;
}

/* ---------- Icon-only (overrides variant solid colors) ---------- */
.base-btn--icon-only {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: var(--btn-radius-sm);
  background: var(--btn-bg-softer);
  border-color: var(--btn-border);
  color: var(--btn-text);
}
.base-btn--icon-only:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-white);
  border-color: var(--btn-border-strong);
  color: var(--btn-text-dark);
}
.base-btn--icon-only.base-btn--danger:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--btn-danger-bg-softer);
  border-color: var(--btn-danger-border-soft);
  color: var(--btn-danger);
}

/* ---------- States ---------- */
.base-btn:disabled,
.base-btn[aria-disabled='true'] {
  opacity: 0.6;
  cursor: not-allowed;
}

.base-btn:focus-visible {
  outline: none;
  box-shadow: var(--btn-focus-ring);
}

.base-btn:active:not(:disabled):not([aria-disabled='true']) {
  transform: translateY(1px);
}

/* Loading spinner */
.base-btn__spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: base-btn-spin 0.7s linear infinite;
}
.base-btn__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.base-btn__label {
  display: inline-flex;
  align-items: center;
}
@keyframes base-btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
