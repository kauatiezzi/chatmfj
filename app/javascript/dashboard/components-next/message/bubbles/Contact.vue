<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useAlert } from 'dashboard/composables';
import { useStore, useMapGetter } from 'dashboard/composables/store';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMessageContext } from '../provider.js';
import BaseBubble from './Base.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';
import { getPhoneSourceIdForInbox } from 'dashboard/components-next/NewConversation/helpers/composeConversationHelper.js';

import {
  DuplicateContactException,
  ExceptionWithMessage,
} from 'shared/helpers/CustomErrors';

const { attachments, inboxId, currentUserId } = useMessageContext();

const $store = useStore();
const router = useRouter();
const { t } = useI18n();
const isStartingConversation = ref(false);
const vCardName = ref('');
const vCardPhoneNumber = ref('');
const inboxGetter = useMapGetter('inboxes/getInbox');
const contactConversationsGetter = useMapGetter(
  'contactConversations/getAllConversationsByContactId'
);

const attachment = computed(() => {
  return attachments.value[0];
});

const isVCardAttachment = computed(() => {
  const extension = attachment.value?.extension || '';
  const dataUrl = attachment.value?.dataUrl || '';
  return (
    extension.toLowerCase() === 'vcf' ||
    decodeURIComponent(dataUrl).toLowerCase().endsWith('.vcf')
  );
});

const phoneNumber = computed(() => {
  return attachment.value?.fallbackTitle || vCardPhoneNumber.value || '';
});

const contactName = computed(() => {
  const { meta } = attachment.value ?? {};
  const { firstName, lastName } = meta ?? {};
  return (
    `${firstName ?? ''} ${lastName ?? ''}`.trim() ||
    vCardName.value ||
    phoneNumber.value
  );
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

const currentInbox = computed(() => {
  return inboxGetter.value(inboxId.value) || {};
});

function unfoldVCard(value) {
  return value.replace(/\r?\n[ \t]/g, '');
}

function getVCardValue(vCard, key) {
  const line = vCard
    .split(/\r?\n/)
    .find(item => item.toUpperCase().startsWith(key));
  return line?.split(':').slice(1).join(':').trim() || '';
}

function parseVCard(vCard) {
  const unfoldedVCard = unfoldVCard(vCard);
  vCardName.value =
    getVCardValue(unfoldedVCard, 'FN') || getVCardValue(unfoldedVCard, 'N');
  vCardPhoneNumber.value = getVCardValue(unfoldedVCard, 'TEL');
}

async function fetchVCardContact() {
  if (!isVCardAttachment.value || !attachment.value?.dataUrl) return;

  try {
    const response = await fetch(attachment.value.dataUrl);
    const vCard = await response.text();
    parseVCard(vCard);
  } catch (error) {
    // Keep the downloadable contact card visible if the vCard cannot be read.
  }
}

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

function navigateToConversation(conversation) {
  const accountId = conversation.account_id || conversation.accountId;
  router.push(`/app/accounts/${accountId}/conversations/${conversation.id}`);
}

async function findOpenConversation(contactId) {
  await $store.dispatch('contactConversations/get', contactId);
  const conversations = contactConversationsGetter.value(contactId);
  return conversations.find(
    conversation =>
      Number(conversation.inboxId || conversation.inbox_id) ===
        Number(inboxId.value) && conversation.status !== 'resolved'
  );
}

async function openOrCreateConversation(contact) {
  const existingConversation = await findOpenConversation(contact.id);
  if (existingConversation) {
    navigateToConversation(existingConversation);
    return;
  }

  const sourceId = getPhoneSourceIdForInbox(
    normalizedPhoneNumber.value,
    currentInbox.value
  );
  if (!sourceId) {
    useAlert(t('COMPOSE_NEW_CONVERSATION.FORM.NO_INBOX_ALERT'));
    return;
  }

  const conversation = await $store.dispatch('contactConversations/create', {
    params: {
      inboxId: inboxId.value,
      sourceId,
      contactId: contact.id,
      assigneeId: currentUserId.value,
    },
    isFromWhatsApp: false,
  });
  navigateToConversation(conversation);
}

async function startConversation() {
  if (!formattedPhoneNumber.value) return;

  isStartingConversation.value = true;
  try {
    const contact = await findOrCreateContact();
    await openOrCreateConversation(contact);
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

onMounted(fetchVCardContact);

watch(
  () => attachment.value?.dataUrl,
  () => fetchVCardContact()
);
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
            {{
              phoneNumber ||
              decodeURIComponent(attachment?.dataUrl || '')
                .split('/')
                .pop()
            }}
          </div>
        </div>
      </div>
      <div class="border-t border-[#ffe1cc] p-3 dark:border-[#2b211c]">
        <NextButton
          v-if="formattedPhoneNumber"
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
        <a
          v-else-if="isVCardAttachment"
          :href="attachment.dataUrl"
          class="flex h-8 w-full items-center justify-center rounded-md bg-[#fff4ea] text-sm font-medium text-[#ff6a00]"
          download
        >
          {{ t('CONVERSATION.DOWNLOAD') }}
        </a>
      </div>
    </div>
  </BaseBubble>
</template>
