<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { INPUT_TYPES } from 'dashboard/components-next/taginput/helper/tagInputHelper.js';
import {
  isPhoneInput,
  normalizePhoneNumber,
} from 'dashboard/components-next/NewConversation/helpers/composeConversationHelper';

import TagInput from 'dashboard/components-next/taginput/TagInput.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  contacts: {
    type: Array,
    required: true,
  },
  selectedContact: {
    type: Object,
    default: null,
  },
  showContactsDropdown: {
    type: Boolean,
    required: true,
  },
  isLoading: {
    type: Boolean,
    required: true,
  },
  isCreatingContact: {
    type: Boolean,
    required: true,
  },
  contactId: {
    type: String,
    default: null,
  },
  contactableInboxesList: {
    type: Array,
    default: () => [],
  },
  showInboxesDropdown: {
    type: Boolean,
    required: true,
  },
  hasErrors: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'searchContacts',
  'setSelectedContact',
  'clearSelectedContact',
  'updateDropdown',
]);

const { t } = useI18n();

const inputType = ref(INPUT_TYPES.EMAIL);

const contactsList = computed(() => {
  return props.contacts?.map(({ name, id, thumbnail, email, ...rest }) => ({
    id,
    label: email ? `${name} (${email})` : name,
    value: id,
    thumbnail: { name, src: thumbnail },
    ...rest,
    name,
    email,
    action: 'contact',
  }));
});

const selectedContactLabel = computed(() => {
  const { name, email = '', phoneNumber = '' } = props.selectedContact || {};
  if (email) {
    return `${name} (${email})`;
  }
  if (phoneNumber) {
    return `${name} (${phoneNumber})`;
  }
  return name || '';
});

const selectedContactInitial = computed(() => {
  return selectedContactLabel.value.charAt(0).toUpperCase();
});

const errorClass = computed(() => {
  return props.hasErrors
    ? '[&_input]:placeholder:!text-n-ruby-9 [&_input]:dark:placeholder:!text-n-ruby-9'
    : '';
});

const handleInput = value => {
  if (isPhoneInput(value)) {
    inputType.value = value.trim().startsWith('+')
      ? INPUT_TYPES.TEL
      : INPUT_TYPES.TEXT;
  } else {
    inputType.value = INPUT_TYPES.EMAIL;
  }
  emit('searchContacts', value);
};

const handleSelectedContact = item => {
  const normalizedItem =
    item.action === 'create' && isPhoneInput(item.value)
      ? { ...item, value: normalizePhoneNumber(item.value) }
      : item;
  emit('setSelectedContact', normalizedItem);
};
</script>

<template>
  <div class="relative flex-1 overflow-y-visible px-4 py-3">
    <div class="flex w-full items-center gap-3">
      <label class="w-9 shrink-0 text-sm font-semibold text-[#7a4a24]">
        {{ t('COMPOSE_NEW_CONVERSATION.FORM.CONTACT_SELECTOR.LABEL') }}
      </label>

      <div
        v-if="isCreatingContact"
        class="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#ffd9bf] bg-[#fff7ef] px-3"
      >
        <span class="text-sm truncate text-n-slate-12">
          {{
            t('COMPOSE_NEW_CONVERSATION.FORM.CONTACT_SELECTOR.CONTACT_CREATING')
          }}
        </span>
      </div>
      <div
        v-else-if="selectedContact"
        class="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#ffd9bf] bg-[#fff7ef] px-2"
      >
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#ff6a00] text-xs font-semibold text-white"
        >
          {{ selectedContactInitial }}
        </span>
        <span
          class="min-w-0 flex-1 truncate text-sm font-medium text-[#1f1f24]"
        >
          {{
            isCreatingContact
              ? t(
                  'COMPOSE_NEW_CONVERSATION.FORM.CONTACT_SELECTOR.CONTACT_CREATING'
                )
              : selectedContactLabel
          }}
        </span>
        <Button
          v-if="!contactId"
          variant="ghost"
          icon="i-lucide-x"
          color="slate"
          :disabled="contactId"
          size="xs"
          @click="emit('clearSelectedContact')"
        />
      </div>
      <div
        v-else
        class="min-h-10 min-w-0 flex-1 rounded-lg border border-[#ffd9bf] bg-white px-3 py-2 shadow-sm transition-colors focus-within:border-[#ff6a00] focus-within:ring-2 focus-within:ring-[#ff6a00]/10 dark:bg-[#211712]"
      >
        <TagInput
          :placeholder="
            t(
              'COMPOSE_NEW_CONVERSATION.FORM.CONTACT_SELECTOR.TAG_INPUT_PLACEHOLDER'
            )
          "
          mode="single"
          :menu-items="contactsList"
          :show-dropdown="showContactsDropdown"
          :is-loading="isLoading"
          :disabled="contactableInboxesList?.length > 0 && showInboxesDropdown"
          allow-create
          :type="inputType"
          class="min-h-6"
          :class="errorClass"
          focus-on-mount
          @input="handleInput"
          @on-click-outside="emit('updateDropdown', 'contacts', false)"
          @add="handleSelectedContact"
          @remove="emit('clearSelectedContact')"
        />
      </div>
    </div>
  </div>
</template>
