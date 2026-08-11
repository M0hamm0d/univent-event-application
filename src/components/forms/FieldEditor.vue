<script setup>
import { computed } from 'vue'
import { PhTrash, PhArrowUp, PhArrowDown, PhCheck, PhPlus, PhX } from '@phosphor-icons/vue'
import {
  FIELD_TYPES,
  isChoiceField,
  isFileField,
  isNumericField,
} from '@/composables/useRegistrationForm'

const props = defineProps({
  field: { type: Object, required: true },
  index: { type: Number, required: true },
  total: { type: Number, required: true },
})

const emit = defineEmits([
  'update:field',
  'remove',
  'move-up',
  'move-down',
])

const typeMeta = computed(
  () => FIELD_TYPES.find((t) => t.type === props.field.type) || { label: props.field.type },
)

function patch(p) {
  emit('update:field', { ...props.field, ...p })
}

function setType(type) {
  patch({ type })
}

function setOption(index, value) {
  const next = [...(props.field.options || [])]
  next[index] = value
  patch({ options: next })
}

function addOption() {
  const next = [...(props.field.options || []), `Option ${(props.field.options?.length || 0) + 1}`]
  patch({ options: next })
}

function removeOption(index) {
  const next = (props.field.options || []).filter((_, i) => i !== index)
  patch({ options: next })
}
</script>

<template>
  <div class="field-editor card">
    <div class="field-editor__head">
      <span class="field-editor__position">#{{ index + 1 }}</span>
      <span class="field-editor__type-badge">{{ typeMeta.label }}</span>
      <div class="field-editor__head-actions">
        <button
          type="button"
          class="icon-btn"
          title="Move up"
          :disabled="index === 0"
          @click="$emit('move-up')"
        >
          <PhArrowUp :size="16" />
        </button>
        <button
          type="button"
          class="icon-btn"
          title="Move down"
          :disabled="index === total - 1"
          @click="$emit('move-down')"
        >
          <PhArrowDown :size="16" />
        </button>
        <button type="button" class="icon-btn icon-btn--danger" title="Remove field" @click="$emit('remove')">
          <PhTrash :size="16" />
        </button>
      </div>
    </div>

    <div class="field-group">
      <label>Question / Label</label>
      <input
        :value="field.label"
        @input="patch({ label: $event.target.value })"
        type="text"
        placeholder="e.g. Why do you want to attend?"
      />
    </div>

    <div class="field-group">
      <label>
        Field Key
        <span class="optional">answer identifier</span>
      </label>
      <input
        :value="field.key"
        @input="patch({ key: $event.target.value })"
        type="text"
        placeholder="auto-generated from label"
      />
      <small class="helper-text-neutral">
        Internal identifier for this answer. Leave default unless you need a specific key.
      </small>
    </div>

    <div class="field-row">
      <div class="field-group">
        <label>Field Type</label>
        <select :value="field.type" @change="setType($event.target.value)">
          <option v-for="t in FIELD_TYPES" :key="t.type" :value="t.type">{{ t.label }}</option>
        </select>
      </div>

      <div class="field-group field-group--check">
        <label class="checkbox-row">
          <input
            type="checkbox"
            :checked="field.required"
            @change="patch({ required: $event.target.checked })"
          />
          <span class="checkbox-row__label">
            <PhCheck v-if="field.required" :size="14" class="check-glyph" />
            Required
          </span>
        </label>
      </div>
    </div>

    <div class="field-group" v-if="!isFileField(field.type)">
      <label>
        Placeholder
        <span class="optional">optional</span>
      </label>
      <input
        :value="field.placeholder"
        @input="patch({ placeholder: $event.target.value })"
        type="text"
        placeholder="e.g. Type your answer here..."
      />
    </div>

    <div class="field-group">
      <label>
        Help / Description
        <span class="optional">optional</span>
      </label>
      <textarea
        :value="field.description"
        @input="patch({ description: $event.target.value })"
        rows="2"
        placeholder="Shown under the field to help students answer."
      ></textarea>
    </div>

    <!-- Options for radio / select / checkbox -->
    <div class="field-group" v-if="isChoiceField(field.type)">
      <label>
        Options
        <span class="optional">at least one required</span>
      </label>
      <div class="options-list">
        <div v-for="(opt, i) in field.options || []" :key="i" class="option-row">
          <input :value="opt" @input="setOption(i, $event.target.value)" type="text" />
          <button type="button" class="icon-btn icon-btn--danger" @click="removeOption(i)" title="Remove option">
            <PhX :size="16" />
          </button>
        </div>
        <button type="button" class="add-option-btn" @click="addOption">
          <PhPlus :size="16" /> Add option
        </button>
      </div>
    </div>

    <!-- Min/Max for number + date -->
    <div class="field-row" v-if="isNumericField(field.type) || field.type === 'date'">
      <div class="field-group">
        <label>
          {{ field.type === 'number' ? 'Min value' : 'Min date' }}
          <span class="optional">optional</span>
        </label>
        <input
          :value="field.validation?.min"
          @input="patch({ validation: { ...field.validation, min: $event.target.value } })"
          :type="field.type === 'number' ? 'number' : 'date'"
          placeholder="none"
        />
      </div>
      <div class="field-group">
        <label>
          {{ field.type === 'number' ? 'Max value' : 'Max date' }}
          <span class="optional">optional</span>
        </label>
        <input
          :value="field.validation?.max"
          @input="patch({ validation: { ...field.validation, max: $event.target.value } })"
          :type="field.type === 'number' ? 'number' : 'date'"
          placeholder="none"
        />
      </div>
    </div>

    <!-- Accepted file types for file / image -->
    <div class="field-group" v-if="isFileField(field.type)">
      <label>
        Accepted file types
        <span class="optional">comma-separated</span>
      </label>
      <input
        :value="(field.fileTypes || []).join(', ')"
        @input="patch({ fileTypes: $event.target.value.split(',').map((s) => s.trim()).filter(Boolean) })"
        type="text"
        :placeholder="field.type === 'image' ? 'image/*' : 'application/pdf, image/*'"
      />
      <small class="helper-text-neutral">
        MIME types or wildcards (e.g. <code>image/*</code> or
        <code>application/pdf, image/png</code>).
      </small>
    </div>
  </div>
</template>

<style scoped>
.field-editor {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field-editor__head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field-editor__position {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 4px 8px;
}
.field-editor__type-badge {
  font-size: 12px;
  font-weight: 500;
  color: #055dfa;
  background: rgba(5, 93, 250, 0.08);
  border-radius: 999px;
  padding: 4px 10px;
}
.field-editor__head-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.icon-btn:hover:not(:disabled) {
  background: #fff;
  border-color: #cbd5e1;
  color: #1e293b;
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.icon-btn--danger:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field-group label {
  font-size: 13px;
  font-weight: 500;
  color: #475569;
}
.field-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
.field-row > .field-group {
  flex: 1;
}
.field-group--check {
  flex: 0 0 auto !important;
  padding-bottom: 8px;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.checkbox-row input {
  width: 16px;
  height: 16px;
}
.checkbox-row__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #1e293b;
}
.check-glyph {
  color: #055dfa;
}

input[type='text'],
input[type='number'],
input[type='date'],
select,
textarea {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.2s;
}
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #055dfa;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(5, 93, 250, 0.1);
}
textarea {
  resize: none;
}

.optional {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 999px;
  margin-left: 6px;
}
.helper-text-neutral {
  font-size: 12px;
  color: #94a3b8;
}
.helper-text-neutral code {
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.option-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.option-row input {
  flex: 1;
}
.add-option-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.add-option-btn:hover {
  background: #fff;
  border-color: #055dfa;
  color: #055dfa;
}

@media (max-width: 480px) {
  .field-row {
    flex-direction: column;
    align-items: stretch;
  }
  .field-group--check {
    padding-bottom: 0;
  }
}
</style>