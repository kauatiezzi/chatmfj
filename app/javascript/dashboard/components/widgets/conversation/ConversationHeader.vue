<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useElementSize } from '@vueuse/core';
import BackButton from '../BackButton.vue';
import InboxName from '../InboxName.vue';
import MoreActions from './MoreActions.vue';
import Avatar from 'next/avatar/Avatar.vue';
import SLACardLabel from './components/SLACardLabel.vue';
import AddLabel from 'shared/components/ui/dropdown/AddLabel.vue';
import LabelDropdown from 'shared/components/ui/label/LabelDropdown.vue';
import wootConstants from 'dashboard/constants/globals';
import { conversationListPageURL } from 'dashboard/helper/URLHelper';
import { snoozedReopenTime } from 'dashboard/helper/snoozeHelpers';
import { useInbox } from 'dashboard/composables/useInbox';
import { useAdmin } from 'dashboard/composables/useAdmin';
import { useConversationLabels } from 'dashboard/composables/useConversationLabels';
import { useI18n } from 'vue-i18n';
import { copyTextToClipboard } from 'shared/helpers/clipboard';
import { useAlert } from 'dashboard/composables';

const props = defineProps({
  chat: {
    type: Object,
    default: () => ({}),
  },
  showBackButton: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();
const store = useStore();
const route = useRoute();
const conversationHeader = ref(null);
const showSearchDropdownLabel = ref(false);
const { width } = useElementSize(conversationHeader);
const { isAWebWidgetInbox } = useInbox();
const { isAdmin } = useAdmin();
const {
  savedLabels,
  activeLabels,
  accountLabels,
  addLabelToConversation,
  removeLabelFromConversation,
} = useConversationLabels();

const currentChat = computed(() => store.getters.getSelectedChat);
const accountId = computed(() => store.getters.getCurrentAccountId);

const chatMetadata = computed(() => props.chat.meta);

const backButtonUrl = computed(() => {
  const {
    params: { inbox_id: inboxId, label, teamId, id: customViewId },
    name,
  } = route;

  const conversationTypeMap = {
    conversation_through_mentions: 'mention',
    conversation_through_participating: 'participating',
    conversation_through_unattended: 'unattended',
  };
  return conversationListPageURL({
    accountId: accountId.value,
    inboxId,
    label,
    teamId,
    conversationType: conversationTypeMap[name],
    customViewId,
  });
});

const isHMACVerified = computed(() => {
  if (!isAWebWidgetInbox.value) {
    return true;
  }
  return chatMetadata.value.hmac_verified;
});

const currentContact = computed(() =>
  store.getters['contacts/getContact'](props.chat.meta.sender.id)
);
const contactPhoneNumber = computed(
  () =>
    currentContact.value?.phone_number ||
    currentContact.value?.phoneNumber ||
    props.chat?.meta?.sender?.phone_number ||
    props.chat?.meta?.sender?.phoneNumber ||
    ''
);

const isSnoozed = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.SNOOZED
);

const snoozedDisplayText = computed(() => {
  const { snoozed_until: snoozedUntil } = currentChat.value;
  if (snoozedUntil) {
    return `${t('CONVERSATION.HEADER.SNOOZED_UNTIL')} ${snoozedReopenTime(snoozedUntil)}`;
  }
  return t('CONVERSATION.HEADER.SNOOZED_UNTIL_NEXT_REPLY');
});

const inbox = computed(() => {
  const { inbox_id: inboxId } = props.chat;
  return store.getters['inboxes/getInbox'](inboxId);
});

const hasMultipleInboxes = computed(
  () => store.getters['inboxes/getInboxes'].length > 1
);

const hasSlaPolicyId = computed(() => props.chat?.sla_policy_id);

const copyConversationId = async () => {
  try {
    await copyTextToClipboard(String(props.chat.id));
    useAlert(t('CONVERSATION.HEADER.COPY_ID_SUCCESS'));
  } catch (error) {
    // error
  }
};

const toggleLabels = () => {
  showSearchDropdownLabel.value = !showSearchDropdownLabel.value;
};

const closeDropdownLabel = () => {
  showSearchDropdownLabel.value = false;
};
</script>

<template>
  <div
    ref="conversationHeader"
    class="flex flex-col gap-3 items-center justify-between flex-1 w-full min-w-0 xl:flex-row px-4 py-3 min-h-24 xl:min-h-16 bg-white dark:bg-[#17120f] border-b border-[#ececf0] dark:border-[#2b211c]"
  >
    <div
      class="flex items-center justify-start w-full xl:w-auto max-w-full min-w-0 xl:flex-1"
    >
      <BackButton
        v-if="showBackButton"
        :back-url="backButtonUrl"
        class="ltr:mr-2 rtl:ml-2"
      />
      <Avatar
        :name="currentContact.name"
        :src="currentContact.thumbnail"
        :size="32"
        :status="currentContact.availability_status"
        hide-offline-status
        rounded-full
      />
      <div
        class="flex flex-col items-start min-w-0 ml-2 overflow-hidden rtl:ml-0 rtl:mr-2"
      >
        <div class="flex flex-row items-center max-w-full gap-1 p-0 m-0">
          <span
            class="text-sm font-semibold truncate leading-tight text-[#1f1f24] dark:text-[#fffaf4]"
          >
            {{ currentContact.name }}
          </span>
          <span
            v-if="contactPhoneNumber"
            class="shrink-0 text-xs font-medium text-[#7a7f89]"
          >
            {{ contactPhoneNumber }}
          </span>
          <fluent-icon
            v-if="!isHMACVerified"
            v-tooltip="$t('CONVERSATION.UNVERIFIED_SESSION')"
            size="14"
            class="text-n-amber-10 my-0 mx-0 min-w-[14px] flex-shrink-0"
            icon="warning"
          />
        </div>

        <div
          class="flex items-center gap-1 overflow-hidden text-xs conversation--header--actions text-n-slate-11 text-ellipsis whitespace-nowrap"
        >
          <button
            type="button"
            class="truncate text-label-small text-[#7a7f89] hover:text-[#ff6a00] !p-0 cursor-pointer"
            @click="copyConversationId"
          >
            {{ `#${chat.id}` }}
          </button>
          <span
            v-if="hasMultipleInboxes"
            aria-hidden="true"
            class="i-lucide-dot size-3 text-[#a3a7b0]"
          />
          <InboxName v-if="hasMultipleInboxes" :inbox="inbox" class="!mx-0" />
          <span
            v-if="isSnoozed"
            aria-hidden="true"
            class="i-lucide-dot size-3 text-[#a3a7b0]"
          />
          <span v-if="isSnoozed" class="font-medium text-n-amber-10">
            {{ snoozedDisplayText }}
          </span>
        </div>
        <div
          v-on-clickaway="closeDropdownLabel"
          class="relative mt-1 flex max-w-full flex-wrap items-center gap-1"
          @keyup.esc="closeDropdownLabel"
        >
          <AddLabel @add="toggleLabels" />
          <woot-label
            v-for="label in activeLabels"
            :key="label.id"
            :title="label.title"
            :description="label.description"
            show-close
            :color="label.color"
            variant="smooth"
            class="max-w-[9rem]"
            @remove="removeLabelFromConversation"
          />

          <div
            :class="{
              'block visible': showSearchDropdownLabel,
              'hidden invisible': !showSearchDropdownLabel,
            }"
            class="absolute top-7 z-[9999] w-64 rounded-lg border border-n-strong bg-n-alpha-3 p-2 shadow-lg backdrop-blur-[100px] dark:border-n-strong"
          >
            <LabelDropdown
              v-if="showSearchDropdownLabel"
              :account-labels="accountLabels"
              :selected-labels="savedLabels"
              :allow-creation="isAdmin"
              @add="addLabelToConversation"
              @remove="removeLabelFromConversation"
            />
          </div>
        </div>
      </div>
    </div>
    <div
      class="flex flex-row items-center justify-start xl:justify-end flex-shrink-0 gap-2 w-full xl:w-auto header-actions-wrap"
    >
      <SLACardLabel
        v-if="hasSlaPolicyId"
        :chat="chat"
        show-extended-info
        :parent-width="width"
        class="hidden md:flex"
      />
      <MoreActions :conversation-id="currentChat.id" />
    </div>
  </div>
</template>
