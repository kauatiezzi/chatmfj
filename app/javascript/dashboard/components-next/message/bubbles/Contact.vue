<script setup>
import { computed, nextTick, ref } from 'vue';
import { useAlert } from 'dashboard/composables';
import { useStore } from 'dashboard/composables/store';
import { useI18n } from 'vue-i18n';
import { useMessageContext } from '../provider.js';
import BaseBubble from './Base.vue';
import ComposeConversation from 'dashboard/components-next/NewConversation/ComposeConversation.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';

import {
  DuplicateContactException,
  ExceptionWithMessage,
} from 'shared/helpers/CustomErrors';

const { attachments } = useMessageContext();

const $store = useStore();
const { t } = useI18n();
const composeConversationRef = ref(null);
const savedContactId = ref(null);
const isStartingConversation = ref(false);

const attachment = computed(() => {
  return attachments.value[0];
});

const phoneNumber = computed(() => {
  return attachment.value?.fallbackTitle || '';
});

const contactName = computed(() => {
  const { meta } = attachment.value ?? {};
  const { firstName, lastName } = meta ?? {};
  return `${firstName ?? ''} ${lastName ?? ''}`.trim() || phoneNumber.value;
});

const contactInitial = computed(() => {
  return contactName.value.charAt(0).toUpperCase();
});

const formattedPhoneNumber = computed(() => {
  return phoneNumber.value.replace(/\s|-|[A-Za-z]/g, '');
});

const rawPhoneNumber = computed(() => {
  return phoneNumber.value.replace(/\D/g, '');
});

const normalizedPhoneNumber = computed(() => {
  return rawPhoneNumber.value ? `+${rawPhoneNumber.value}` : '';
});

function getContactObject() {
  const contactItem = {
    name: contactName.value,
    phone_number: normalizedPhoneNumber.value,
  };
  return contactItem;
}

async function filterContactByNumber(searchCandidate) {
  const query = {
    attribute_key: 'phone_number',
    filter_operator: 'equal_to',
    values: [searchCandidate],
    attribute_model: 'standard',
    custom_attribute_type: '',
  };

  const queryPayload = { payload: [query] };
  const contacts = await $store.dispatch('contacts/filter', {
    queryPayload,
    resetState: false,
  });
  return contacts.shift();
}

async function findOrCreateContact() {
  let contact = await filterContactByNumber(normalizedPhoneNumber.value);
  if (!contact) {
    contact = await $store.dispatch('contacts/create', getContactObject());
    useAlert(t('CONTACT_FORM.SUCCESS_MESSAGE'));
  }
  return contact;
}

async function startConversation() {
  if (!formattedPhoneNumber.value) return;

  isStartingConversation.value = true;
  try {
    const contact = await findOrCreateContact();
    savedContactId.value = String(contact.id);
    await nextTick();
    composeConversationRef.value?.show();
  } catch (error) {
    if (error instanceof DuplicateContactException) {
      if (error.data.includes('phone_number')) {
        useAlert(t('CONTACT_FORM.FORM.PHONE_NUMBER.DUPLICATE'));
      }
    } else if (error instanceof ExceptionWithMessage) {
      useAlert(error.data);
    } else {
      useAlert(t('CONTACT_FORM.ERROR_MESSAGE'));
    }
  } finally {
    isStartingConversation.value = false;
  }
}
</script>

<template>
  <BaseBubble class="overflow-hidden p-0" data-bubble-name="contact">
    <div class="w-72 max-w-[78vw] bg-white dark:bg-[#211712]">
      <div class="flex items-start gap-3 p-4">
        <div
          class="flex size-12 flex-shrink-0 items-center justify-center rounded-full bg-[#ff6a00] text-base font-semibold text-white"
        >
          {{ contactInitial }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 text-xs text-[#7a7f89]">
            <Icon icon="i-lucide-contact" class="size-3.5" />
            <span>
              {{ t('CONVERSATION.CONTACT_CARD.SHARED_CONTACT') }}
            </span>
          </div>
          <div class="mt-1 truncate text-sm font-semibold text-[#1f1f24]">
            {{ contactName }}
          </div>
          <div class="mt-0.5 truncate text-sm text-[#7a7f89]">
            {{ phoneNumber }}
          </div>
        </div>
      </div>
      <div class="border-t border-[#ffe1cc] p-3 dark:border-[#2b211c]">
        <ComposeConversation
          ref="composeConversationRef"
          :contact-id="savedContactId"
          align="start"
        >
          <template #trigger>
            <NextButton
              :label="t('CONVERSATION.CONTACT_CARD.START_CONVERSATION')"
              icon="i-ph-chat-circle-dots"
              amber
              solid
              sm
              class="w-full"
              :is-loading="isStartingConversation"
              :disabled="!formattedPhoneNumber || isStartingConversation"
              @click.stop.prevent="startConversation"
            />
          </template>
        </ComposeConversation>
      </div>
    </div>
  </BaseBubble>
</template>
